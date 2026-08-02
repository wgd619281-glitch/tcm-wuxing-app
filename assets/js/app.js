/* ═══════════════════════════════════════════
   中药五行分类学习 App · 核心逻辑
   ═══════════════════════════════════════════ */

const App = {
  herbs: [],
  favorites: [],
  currentWuxing: 'all',
  currentCategory: '',
  currentStroke: null,
  searchKeyword: '',

  // 五行配置
  WX_CONFIG: {
    '木': { cls: 'wood', organ: '肝胆', evil: '风邪', color: '#4A8B5C' },
    '火': { cls: 'fire', organ: '心小肠', evil: '火邪', color: '#C0392B' },
    '土': { cls: 'earth', organ: '脾胃', evil: '湿邪', color: '#C99A14' },
    '金': { cls: 'metal', organ: '肺大肠', evil: '燥邪', color: '#8A7E64' },
    '水': { cls: 'water', organ: '肾膀胱', evil: '寒邪', color: '#2C5F7C' },
  },

  // ═══ 初始化 ═══
  async init() {
    try {
      // 优先使用 script 标签预加载的全局变量（避免 CORS 问题）
      let data;
      if (window.HERBS_DATA) {
        data = window.HERBS_DATA;
      } else {
        const res = await fetch('assets/data/herbs.json');
        data = await res.json();
      }
      this.herbs = data.herbs;
      this.favorites = JSON.parse(localStorage.getItem('tcm_favs') || '[]');
      this.renderAll();
      this.bindEvents();
    } catch(e) {
      console.error('数据加载失败:', e);
      document.getElementById('tab-herbs').innerHTML = '<div class="empty-state"><div class="icon">⚠</div><div class="text">数据加载失败：' + (e.message || '未知错误') + '</div></div>';
    }
  },

  // ═══ 事件绑定 ═══
  bindEvents() {
    // Tab 切换
    document.querySelectorAll('.tab-item').forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        this.switchTab(target);
      });
    });

    // 搜索
    const searchInput = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear');
    searchInput.addEventListener('input', (e) => {
      this.searchKeyword = e.target.value.trim();
      clearBtn.style.display = this.searchKeyword ? 'flex' : 'none';
      this.renderSearchResults();
    });
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      this.searchKeyword = '';
      clearBtn.style.display = 'none';
      this.renderSearchResults();
    });

    // 详情关闭
    document.getElementById('detail-overlay').addEventListener('click', () => this.closeDetail());
    document.getElementById('detail-close').addEventListener('click', () => this.closeDetail());
  },

  // ═══ Tab 切换 ═══
  switchTab(tab) {
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    document.querySelector(`.tab-item[data-tab="${tab}"]`).classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');

    const titles = { herbs: '药库', search: '检索', theory: '学堂', profile: '我的' };
    document.getElementById('app-title').innerHTML = `<span class="wx">${titles[tab] || ''}</span>`;
    window.scrollTo(0, 0);
  },

  // ═══ 渲染全部 ═══
  renderAll() {
    this.renderWuxingBar();
    this.renderHerbList();
    this.renderStrokeIndex();
    this.renderSearchResults();
    this.renderTheory();
    this.renderProfile();
  },

  // ═══ 五行选择条 ═══
  renderWuxingBar() {
    const bar = document.getElementById('wuxing-bar');
    if (!bar) return;
    const counts = {};
    ['木','火','土','金','水'].forEach(w => {
      counts[w] = this.herbs.filter(h => h.wuxing === w).length;
    });

    let html = `<div class="wx-chip all active" data-wx="all">全部<span class="cnt">${this.herbs.length}</span></div>`;
    ['木','火','土','金','水'].forEach(w => {
      const cfg = this.WX_CONFIG[w];
      html += `<div class="wx-chip ${cfg.cls}" data-wx="${w}">${w}<span class="cnt">${counts[w]}</span></div>`;
    });
    bar.innerHTML = html;

    bar.querySelectorAll('.wx-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        bar.querySelectorAll('.wx-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.currentWuxing = chip.dataset.wx;
        this.currentCategory = '';
        this.renderCategoryFilter();
        this.renderHerbList();
      });
    });
  },

  // ═══ 功效子类筛选 ═══
  renderCategoryFilter() {
    const container = document.getElementById('category-filter');
    if (!container) return;

    let filtered = this.currentWuxing === 'all'
      ? this.herbs
      : this.herbs.filter(h => h.wuxing === this.currentWuxing);

    const cats = {};
    filtered.forEach(h => {
      const c = h.category || '其他';
      cats[c] = (cats[c] || 0) + 1;
    });
    const sortedCats = Object.entries(cats).sort((a, b) => b[1] - a[1]);

    let html = `<div class="cat-chip ${!this.currentCategory ? 'active' : ''}" data-cat="">全部</div>`;
    sortedCats.forEach(([cat, cnt]) => {
      html += `<div class="cat-chip ${this.currentCategory === cat ? 'active' : ''}" data-cat="${cat}">${cat} (${cnt})</div>`;
    });
    container.innerHTML = html;

    container.querySelectorAll('.cat-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        container.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.currentCategory = chip.dataset.cat;
        this.renderHerbList();
      });
    });
  },

  // ═══ 药物列表 ═══
  renderHerbList() {
    const container = document.getElementById('herb-list');
    if (!container) return;

    let filtered = this.herbs;
    if (this.currentWuxing !== 'all') {
      filtered = filtered.filter(h => h.wuxing === this.currentWuxing);
    }
    if (this.currentCategory) {
      filtered = filtered.filter(h => (h.category || '其他') === this.currentCategory);
    }

    if (filtered.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="icon">🌿</div><div class="text">暂无药物</div></div>';
      return;
    }

    container.innerHTML = filtered.map(h => this.herbItemHTML(h)).join('');
    container.querySelectorAll('.herb-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        this.showDetail(id);
      });
    });
  },

  // ═══ 药物列表项 HTML ═══
  herbItemHTML(h) {
    const cfg = this.WX_CONFIG[h.wuxing] || { cls: 'wood' };
    let toxBadge = '';
    if (h.toxicity === '大毒') toxBadge = '<span class="tox-badge big">大毒</span>';
    else if (h.toxicity === '有毒') toxBadge = '<span class="tox-badge mid">有毒</span>';
    else if (h.toxicity === '小毒') toxBadge = '<span class="tox-badge small">小毒</span>';

    return `
      <div class="herb-item ${cfg.cls}" data-id="${h.id}">
        <div class="wx-tag">${h.wuxing}</div>
        <div class="info">
          <div class="name-row">
            <span class="name">${h.name}</span>
            ${toxBadge}
          </div>
          <div class="cat">${h.category || ''}</div>
          <div class="eff">${h.efficacy || ''}</div>
        </div>
      </div>
    `;
  },

  // ═══ 笔画索引 ═══
  renderStrokeIndex() {
    const container = document.getElementById('stroke-index');
    if (!container) return;

    // 简单笔画分组：按药名字符数（粗略近似笔画分组）
    const groups = {};
    this.herbs.forEach(h => {
      const len = h.name.length;
      const group = len <= 2 ? '2字' : len === 3 ? '3字' : len >= 4 ? '4字+' : '其他';
      if (!groups[group]) groups[group] = 0;
      groups[group]++;
    });

    const order = ['2字', '3字', '4字+'];
    let html = `<div class="stroke-chip ${!this.currentStroke ? 'active' : ''}" data-stroke="">全部</div>`;
    order.forEach(s => {
      if (groups[s]) {
        html += `<div class="stroke-chip ${this.currentStroke === s ? 'active' : ''}" data-stroke="${s}">${s}<span class="sc">${groups[s]}</span></div>`;
      }
    });
    container.innerHTML = html;

    container.querySelectorAll('.stroke-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        container.querySelectorAll('.stroke-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.currentStroke = chip.dataset.stroke;
        this.renderSearchResults();
      });
    });
  },

  // ═══ 搜索结果 ═══
  renderSearchResults() {
    const container = document.getElementById('search-results');
    if (!container) return;

    let filtered = this.herbs;

    // 笔画筛选
    if (this.currentStroke) {
      filtered = filtered.filter(h => {
        const len = h.name.length;
        if (this.currentStroke === '2字') return len <= 2;
        if (this.currentStroke === '3字') return len === 3;
        if (this.currentStroke === '4字+') return len >= 4;
        return true;
      });
    }

    // 关键词搜索
    if (this.searchKeyword) {
      const kw = this.searchKeyword.toLowerCase();
      filtered = filtered.filter(h =>
        h.name.includes(this.searchKeyword) ||
        (h.efficacy || '').includes(this.searchKeyword) ||
        (h.category || '').includes(this.searchKeyword) ||
        (h.natureMeridian || '').includes(this.searchKeyword)
      );
    }

    if (filtered.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="icon">🔍</div><div class="text">未找到匹配的药物</div></div>';
      return;
    }

    container.innerHTML = `<div style="font-size:.78rem;color:var(--muted);margin-bottom:10px">找到 ${filtered.length} 味药</div>` +
      filtered.map(h => this.herbItemHTML(h)).join('');

    container.querySelectorAll('.herb-item').forEach(item => {
      item.addEventListener('click', () => {
        this.showDetail(item.dataset.id);
      });
    });
  },

  // ═══ 药物详情 ═══
  showDetail(id) {
    const h = this.herbs.find(x => x.id === id);
    if (!h) return;

    const cfg = this.WX_CONFIG[h.wuxing] || { cls: 'wood' };
    const isFav = this.favorites.includes(id);

    // 毒性警示
    let toxAlert = '';
    if (h.toxicity) {
      const level = h.toxicity === '大毒' ? '大毒·严禁过量' : h.toxicity === '有毒' ? '有毒·须遵医嘱' : '小毒·慎用';
      toxAlert = `<div class="tox-alert"><span class="ta-icon">⚠</span><span class="ta-text">${level} — ${h.toxicity}</span></div>`;
    }

    // 归经标签
    let meridianTags = '';
    if (h.meridians && h.meridians.length > 0) {
      meridianTags = '<div class="meridian-tags">' +
        h.meridians.map(m => `<span class="meridian-tag">${m}经</span>`).join('') +
        '</div>';
    }

    const html = `
      <div class="detail-handle"></div>
      <button class="detail-close" id="detail-close-inner">✕</button>
      <div class="detail-hero ${cfg.cls}">
        <div class="wx-deco"></div>
        <div class="wx-tag-lg">${h.wuxing}</div>
        <div class="d-name">
          ${h.name}
          ${h.toxicity === '大毒' ? '<span class="tox-badge big">大毒</span>' : ''}
          ${h.toxicity === '有毒' ? '<span class="tox-badge mid">有毒</span>' : ''}
          ${h.toxicity === '小毒' ? '<span class="tox-badge small">小毒</span>' : ''}
        </div>
        <div class="d-cat">${h.category || ''} · 五行纳${h.wuxing} · 对应${cfg.organ}</div>
        <div style="margin-top:12px;position:relative">
          <button class="fav-btn ${isFav ? 'active' : ''}" id="fav-toggle">
            ${isFav ? '★ 已收藏' : '☆ 收藏'}
          </button>
        </div>
      </div>
      <div class="detail-body">
        ${toxAlert}
        <div class="field-card">
          <div class="f-label"><span class="dot"></span>性味归经</div>
          <div class="f-value">${h.natureMeridian || '—'}</div>
          ${meridianTags}
        </div>
        <div class="field-card">
          <div class="f-label"><span class="dot"></span>功效</div>
          <div class="f-value">${h.efficacy || '—'}</div>
        </div>
        <div class="field-card">
          <div class="f-label"><span class="dot"></span>用法用量</div>
          <div class="f-value">${h.dosage || '—'}</div>
        </div>
        ${h.caution ? `<div class="field-card" style="border-left:3px solid var(--fire)"><div class="f-label" style="color:var(--fire)"><span class="dot" style="background:var(--fire)"></span>使用注意</div><div class="f-value">${h.caution}</div></div>` : ''}
        ${h.characteristic ? `<div class="field-card"><div class="f-label"><span class="dot"></span>性能特点</div><div class="f-value">${h.characteristic}</div></div>` : ''}
        <div class="field-card analysis">
          <div class="f-label"><span class="dot"></span>五行解析</div>
          <div class="f-value">${h.analysis || '—'}</div>
        </div>
        <div style="text-align:center;padding:16px 0 8px;font-size:.72rem;color:var(--muted2)">
          数据源自《中药五行分类研究》牛志纲著 · 仅供学习参考
        </div>
      </div>
    `;

    document.getElementById('detail-panel').innerHTML = html;
    document.getElementById('detail-overlay').classList.add('show');
    document.getElementById('detail-panel').classList.add('show');

    // 关闭按钮
    document.getElementById('detail-close-inner').addEventListener('click', () => this.closeDetail());

    // 收藏切换
    document.getElementById('fav-toggle').addEventListener('click', () => {
      this.toggleFavorite(id);
      this.showDetail(id); // 重新渲染
    });
  },

  closeDetail() {
    document.getElementById('detail-overlay').classList.remove('show');
    document.getElementById('detail-panel').classList.remove('show');
  },

  // ═══ 收藏管理 ═══
  toggleFavorite(id) {
    const idx = this.favorites.indexOf(id);
    if (idx >= 0) {
      this.favorites.splice(idx, 1);
    } else {
      this.favorites.push(id);
    }
    localStorage.setItem('tcm_favs', JSON.stringify(this.favorites));
    this.renderProfile();
  },

  // ═══ 学堂 ═══
  renderTheory() {
    const container = document.getElementById('theory-content');
    if (!container) return;

    const theories = [
      { wx: '木', organ: '肝·胆', evil: '风邪', desc: '肝主疏泄、主藏血，开窍于目。木类药以祛风湿、活血化瘀、平肝熄风、理气、补血为主。', count: 149 },
      { wx: '火', organ: '心·小肠', evil: '火（热）邪', desc: '心主血脉、主神明。火类药以清热、安神、开窍为主，主治热扰神明及心移热小肠。', count: 39 },
      { wx: '土', organ: '脾·胃', evil: '湿邪', desc: '脾主运化、主统血。土类药以补气、化湿、温里、消食、驱虫为主，为后天之本。', count: 66 },
      { wx: '金', organ: '肺·大肠', evil: '燥邪', desc: '肺主气、司呼吸。金类药以解表、清热、化痰止咳、泻下、补阴为主。', count: 97 },
      { wx: '水', organ: '肾·膀胱', evil: '寒邪', desc: '肾藏精、主水。水类药以补阳、补阴、利水渗湿、祛风湿、温里为主。', count: 67 },
    ];

    let overview = '<div class="wuxing-overview">';
    theories.forEach(t => {
      const cfg = this.WX_CONFIG[t.wx];
      overview += `<div class="wo-item ${cfg.cls}" data-wx="${t.wx}">
        <div class="wo-char">${t.wx}</div>
        <div class="wo-organ">${t.organ}</div>
        <div class="wo-cnt">${t.count}味</div>
      </div>`;
    });
    overview += '</div>';

    let cards = '';
    theories.forEach(t => {
      const cfg = this.WX_CONFIG[t.wx];
      cards += `<div class="theory-card ${cfg.cls}">
        <div class="tc-banner">${t.wx}</div>
        <div class="tc-body">
          <div class="tc-title">${t.wx}类药 · ${t.organ}</div>
          <div class="tc-desc">${t.desc}</div>
          <div class="tc-meta">
            <span>📍 主治病邪：${t.evil}</span>
            <span>🌿 收录 ${t.count} 味</span>
          </div>
        </div>
      </div>`;
    });

    container.innerHTML = overview + `
      <div style="font-size:.9rem;font-weight:700;margin-bottom:10px;color:var(--ink)">五行分类详解</div>
    ` + cards;

    // 五行总览点击跳转
    container.querySelectorAll('.wo-item').forEach(item => {
      item.addEventListener('click', () => {
        const wx = item.dataset.wx;
        this.switchTab('herbs');
        document.querySelectorAll('.wx-chip').forEach(c => c.classList.remove('active'));
        const target = document.querySelector(`.wx-chip[data-wx="${wx}"]`);
        if (target) {
          target.classList.add('active');
          this.currentWuxing = wx;
          this.currentCategory = '';
          this.renderCategoryFilter();
          this.renderHerbList();
        }
      });
    });
  },

  // ═══ 我的 ═══
  renderProfile() {
    const container = document.getElementById('profile-content');
    if (!container) return;

    const favHerbs = this.favorites.map(id => this.herbs.find(h => h.id === id)).filter(h => h);
    const toxicCount = this.herbs.filter(h => h.toxicity).length;
    const categories = new Set(this.herbs.map(h => h.category)).size;

    let favHTML = '';
    if (favHerbs.length > 0) {
      favHTML = favHerbs.map(h => this.herbItemHTML(h)).join('');
    } else {
      favHTML = '<div class="empty-state"><div class="icon">☆</div><div class="text">暂无收藏<br>点击药物详情中的"收藏"添加</div></div>';
    }

    container.innerHTML = `
      <div class="profile-header">
        <div class="avatar">🌿</div>
        <div class="ph-name">中药五行学习者</div>
        <div class="ph-sub">已收录 ${this.herbs.length} 味药 · ${categories} 个功效子类</div>
        <div class="profile-stats">
          <div class="ph-stat"><div class="n">${this.herbs.length}</div><div class="l">总药味</div></div>
          <div class="ph-stat"><div class="n">${this.favorites.length}</div><div class="l">已收藏</div></div>
          <div class="ph-stat"><div class="n">${toxicCount}</div><div class="l">毒麻药</div></div>
        </div>
      </div>
      <div class="menu-list">
        <div class="menu-item" id="menu-fav">
          <div class="mi-icon" style="background:rgba(181,64,46,0.1)">★</div>
          <div class="mi-label">我的收藏</div>
          <div class="mi-count">${this.favorites.length}</div>
          <div class="mi-arrow">›</div>
        </div>
        <div class="menu-item" id="menu-toxic">
          <div class="mi-icon" style="background:rgba(192,57,43,0.1)">⚠</div>
          <div class="mi-label">毒麻药警示</div>
          <div class="mi-count">${toxicCount}</div>
          <div class="mi-arrow">›</div>
        </div>
      </div>
      <div id="fav-section">
        <div style="font-size:.9rem;font-weight:700;margin-bottom:10px;color:var(--ink);padding:0 4px">我的收藏</div>
        <div class="fav-list">${favHTML}</div>
      </div>
    `;

    // 收藏列表点击
    container.querySelectorAll('.herb-item').forEach(item => {
      item.addEventListener('click', () => this.showDetail(item.dataset.id));
    });

    // 毒麻药菜单
    const menuToxic = document.getElementById('menu-toxic');
    if (menuToxic) {
      menuToxic.addEventListener('click', () => {
        this.switchTab('search');
        document.getElementById('search-input').value = '有毒';
        this.searchKeyword = '有毒';
        document.getElementById('search-clear').style.display = 'flex';
        this.renderSearchResults();
      });
    }
  },
};

// 启动
document.addEventListener('DOMContentLoaded', () => App.init());
