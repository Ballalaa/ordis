// Ordis admin dashboard

const page = document.currentScript.dataset.page;

if (page === 'login') {
  initLoginPage();
} else {
  initDashboard();
}

// ==================================================================
// Login page
// ==================================================================

function initLoginPage() {
  const form = document.getElementById('login-form');
  const status = document.getElementById('login-status');
  const submitBtn = document.getElementById('login-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.textContent = '';
    status.className = 'form-status';
    submitBtn.disabled = true;

    try {
      const res = await fetch('/admin/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: document.getElementById('username').value.trim(),
          password: document.getElementById('password').value,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        window.location.href = '/admin-dashboard';
      } else {
        status.textContent = data.error || 'შესვლა ვერ მოხერხდა.';
        status.classList.add('is-error');
      }
    } catch (err) {
      status.textContent = 'სერვერთან დაკავშირება ვერ მოხერხდა.';
      status.classList.add('is-error');
    } finally {
      submitBtn.disabled = false;
    }
  });
}

// ==================================================================
// OKLCH ordinal ramp — validated per the dataviz skill (one hue,
// monotone lightness, light end clears a light surface).
// ==================================================================

function oklchToHex(L, C, Hdeg) {
  const h = (Hdeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  let r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  const lin2s = (c) => {
    c = Math.max(0, Math.min(1, c));
    return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  };
  r = lin2s(r); g = lin2s(g); bl = lin2s(bl);
  const toHex = (c) => Math.round(c * 255).toString(16).padStart(2, '0');
  return '#' + toHex(r) + toHex(g) + toHex(bl);
}

function isDarkMode() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

// Coral ramp (plan tiers), one hue/chroma, bounds validated per mode against
// that mode's surface — dark mode is its own validated ramp, not a flip of
// the light one (its "problem end" is the darkest step, not the lightest).
// Light: L 0.72->0.46 vs surface #fcfcfb. Dark: L 0.76->0.48 vs surface #241D36.
function planRamp(n) {
  if (n <= 0) return [];
  const dark = isDarkMode();
  if (n === 1) return [dark ? '#d45b3e' : '#ce5438'];
  const lightL = dark ? 0.76 : 0.72;
  const darkL = dark ? 0.48 : 0.46;
  const steps = [];
  for (let i = 0; i < n; i++) {
    const L = lightL - (i * (lightL - darkL)) / (n - 1);
    steps.push(oklchToHex(L, 0.16, 34.5));
  }
  return steps;
}

// Teal ramp (member lifecycle stage), fixed 4-step order, separately
// validated per mode (see planRamp comment).
const STATUS_RAMP_LIGHT = {
  new: '#3fbbac',
  contacted: '#008f81',
  active: '#006b5e',
  inactive: '#00483e',
};
const STATUS_RAMP_DARK = {
  new: '#4fc8b8',
  contacted: '#23a899',
  active: '#00897b',
  inactive: '#006b5e',
};
function statusRamp() {
  return isDarkMode() ? STATUS_RAMP_DARK : STATUS_RAMP_LIGHT;
}

// ==================================================================
// Dashboard
// ==================================================================

function initDashboard() {
  initNav();
  initLogout();
  loadOverview();
  initMembersPanel();
  initPricingPanel();
  initSettingsPanel();

  // Chart colors are validated separately per theme (see planRamp/statusRamp),
  // so a toggle mid-session needs an actual re-render, not just a CSS flip.
  window.addEventListener('ordis-themechange', loadOverview);
}

async function apiFetch(url, options) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 401) {
    window.location.href = '/home-login';
    throw new Error('unauthorized');
  }
  return res;
}

function initNav() {
  const links = document.querySelectorAll('.admin-nav-link');
  const panels = document.querySelectorAll('.admin-panel');

  links.forEach((link) => {
    link.addEventListener('click', () => {
      const target = link.dataset.panel;
      links.forEach((l) => l.classList.toggle('is-active', l === link));
      panels.forEach((p) => p.classList.toggle('is-active', p.dataset.panel === target));
    });
  });
}

function initLogout() {
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch('/admin/api/logout', { method: 'POST' });
    window.location.href = '/home';
  });
}

// ---------------- Overview ----------------

async function loadOverview() {
  const res = await apiFetch('/admin/api/analytics');
  const data = await res.json();
  if (!data.ok) return;

  renderKpis(data);
  renderDailyChart(data.daily);
  renderOrdinalChart('chart-by-plan', Object.entries(data.by_plan), planRamp(Object.keys(data.by_plan).length));
  renderOrdinalChart(
    'chart-by-status',
    ['new', 'contacted', 'active', 'inactive'].map((s) => [data.status_labels[s], data.by_status[s]]),
    ['new', 'contacted', 'active', 'inactive'].map((s) => statusRamp()[s])
  );
}

function renderKpis(data) {
  const tiles = [
    { label: 'სულ წევრები', value: data.total_members },
    { label: 'ახალი — ბოლო 7 დღე', value: data.new_7d },
    { label: 'ახალი — ბოლო 30 დღე', value: data.new_30d },
    { label: 'აქტიური პაკეტები', value: data.plans_count },
  ];
  const row = document.getElementById('kpi-row');
  row.innerHTML = tiles
    .map((t) => `<div class="kpi-tile"><div class="kpi-label">${t.label}</div><div class="kpi-value">${t.value}</div></div>`)
    .join('');
}

function renderDailyChart(daily) {
  const container = document.getElementById('chart-daily');
  const max = Math.max(1, ...daily.map((d) => d.count));
  const w = 720, h = 180, padBottom = 24, padTop = 10;
  const barGap = 6;
  const barW = Math.min(24, (w - barGap * (daily.length - 1)) / daily.length);
  const totalBarsWidth = barW * daily.length + barGap * (daily.length - 1);
  const startX = (w - totalBarsWidth) / 2;

  let bars = '';
  let gridlines = '';
  const gridSteps = 3;
  for (let i = 0; i <= gridSteps; i++) {
    const y = padTop + ((h - padTop - padBottom) * i) / gridSteps;
    gridlines += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" class="chart-gridline" />`;
  }

  daily.forEach((d, i) => {
    const x = startX + i * (barW + barGap);
    const barH = ((h - padTop - padBottom) * d.count) / max;
    const y = h - padBottom - barH;
    const label = new Date(d.date + 'T00:00:00').toLocaleDateString('ka-GE', { day: 'numeric', month: 'short' });
    bars += `<rect x="${x}" y="${y}" width="${barW}" height="${Math.max(barH, d.count > 0 ? 2 : 0)}" rx="4" class="chart-bar" data-date="${label}" data-count="${d.count}" />`;
    if (i % 2 === 0 || daily.length <= 10) {
      bars += `<text x="${x + barW / 2}" y="${h - 6}" text-anchor="middle" class="chart-axis-label">${label}</text>`;
    }
  });

  container.innerHTML = `
    <div class="chart-wrap">
      <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">
        ${gridlines}
        ${bars}
      </svg>
      <div class="chart-tooltip" id="daily-tooltip"></div>
    </div>
  `;

  const tooltip = document.getElementById('daily-tooltip');
  container.querySelectorAll('.chart-bar').forEach((bar) => {
    bar.addEventListener('mouseenter', (e) => {
      tooltip.textContent = `${bar.dataset.date}: ${bar.dataset.count} წევრი`;
      tooltip.classList.add('is-visible');
    });
    bar.addEventListener('mousemove', (e) => {
      const rect = container.getBoundingClientRect();
      tooltip.style.left = e.clientX - rect.left + 'px';
      tooltip.style.top = e.clientY - rect.top - 8 + 'px';
    });
    bar.addEventListener('mouseleave', () => tooltip.classList.remove('is-visible'));
  });
}

function renderOrdinalChart(containerId, entries, colors) {
  const container = document.getElementById(containerId);
  const filtered = entries.filter(([, count]) => count > 0);

  if (!filtered.length) {
    container.innerHTML = '<p class="ordinal-empty">მონაცემები არ არის.</p>';
    return;
  }

  const max = Math.max(...filtered.map(([, count]) => count));
  container.innerHTML = filtered
    .map(([label, count], i) => {
      const color = colors[entries.findIndex((e) => e[0] === label)] || colors[i] || '#999';
      const pct = Math.max(4, (count / max) * 100);
      return `
        <div class="ordinal-row">
          <span class="ordinal-label">${escapeHtml(label)}</span>
          <span class="ordinal-track"><span class="ordinal-fill" style="width:${pct}%;background:${color}"></span></span>
          <span class="ordinal-value">${count}</span>
        </div>
      `;
    })
    .join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------------- Members ----------------

let membersPlansCache = [];

function initMembersPanel() {
  const search = document.getElementById('member-search');
  const statusFilter = document.getElementById('filter-status');
  const planFilter = document.getElementById('filter-plan');

  statusFilter.innerHTML =
    '<option value="">ყველა სტატუსი</option>' +
    ['new', 'contacted', 'active', 'inactive']
      .map((s) => `<option value="${s}">${STATUS_LABEL(s)}</option>`)
      .join('');

  let debounceTimer;
  const reload = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(loadMembers, 200);
  };

  search.addEventListener('input', reload);
  statusFilter.addEventListener('change', loadMembers);
  planFilter.addEventListener('change', loadMembers);

  loadMembers();
}

function STATUS_LABEL(s) {
  return { new: 'ახალი', contacted: 'დაკონტაქტებული', active: 'აქტიური', inactive: 'არააქტიური' }[s] || s;
}

async function loadMembers() {
  const q = document.getElementById('member-search').value.trim();
  const status = document.getElementById('filter-status').value;
  const plan = document.getElementById('filter-plan').value;

  const [membersRes, plansRes] = await Promise.all([
    apiFetch(`/admin/api/members?q=${encodeURIComponent(q)}&status=${status}&plan=${encodeURIComponent(plan)}`),
    apiFetch('/admin/api/plans'),
  ]);
  const membersData = await membersRes.json();
  const plansData = await plansRes.json();
  if (!membersData.ok) return;

  membersPlansCache = plansData.plans || [];
  const planFilter = document.getElementById('filter-plan');
  const currentPlanValue = planFilter.value;
  planFilter.innerHTML =
    '<option value="">ყველა პაკეტი</option>' +
    membersPlansCache.map((p) => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}</option>`).join('');
  planFilter.value = currentPlanValue;

  renderMembersTable(membersData.members);
}

function renderMembersTable(members) {
  const tbody = document.getElementById('members-tbody');
  document.getElementById('members-count').textContent = `${members.length} წევრი`;

  if (!members.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="table-empty">შედეგები არ მოიძებნა</div></td></tr>`;
    return;
  }

  const planOptions = (selected) =>
    ['<option value="">—</option>']
      .concat(
        membersPlansCache.map(
          (p) => `<option value="${escapeHtml(p.name)}" ${p.name === selected ? 'selected' : ''}>${escapeHtml(p.name)}</option>`
        )
      )
      .join('');

  const statusOptions = (selected) =>
    ['new', 'contacted', 'active', 'inactive']
      .map((s) => `<option value="${s}" ${s === selected ? 'selected' : ''}>${STATUS_LABEL(s)}</option>`)
      .join('');

  tbody.innerHTML = members
    .map((m) => {
      const date = new Date(m.created_at).toLocaleDateString('ka-GE', { year: 'numeric', month: 'short', day: 'numeric' });
      return `
        <tr data-id="${m.id}">
          <td>${escapeHtml(m.first_name)} ${escapeHtml(m.last_name)}</td>
          <td class="member-email">${escapeHtml(m.email)}</td>
          <td>+995 ${escapeHtml(m.phone)}</td>
          <td><select class="member-plan-select" data-id="${m.id}">${planOptions(m.plan)}</select></td>
          <td><select class="member-status-select" data-id="${m.id}">${statusOptions(m.status)}</select></td>
          <td>${date}</td>
          <td>
            <button class="row-delete" data-id="${m.id}" title="წაშლა" aria-label="წაშლა">
              <svg viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </td>
        </tr>
      `;
    })
    .join('');

  tbody.querySelectorAll('.member-plan-select').forEach((sel) => {
    sel.addEventListener('change', () => updateMember(sel.dataset.id, { plan: sel.value || null }));
  });
  tbody.querySelectorAll('.member-status-select').forEach((sel) => {
    sel.addEventListener('change', () => updateMember(sel.dataset.id, { status: sel.value }));
  });
  tbody.querySelectorAll('.row-delete').forEach((btn) => {
    btn.addEventListener('click', () => deleteMember(btn.dataset.id));
  });
}

async function updateMember(id, patch) {
  await apiFetch(`/admin/api/members/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
  loadOverview();
}

async function deleteMember(id) {
  if (!window.confirm('წავშალო ეს წევრი? ეს მოქმედება შეუქცევადია.')) return;
  await apiFetch(`/admin/api/members/${id}`, { method: 'DELETE' });
  loadMembers();
  loadOverview();
}

// ---------------- Pricing ----------------

function initPricingPanel() {
  document.getElementById('add-plan-btn').addEventListener('click', () => addPlanCard());
  loadPlans();
}

async function loadPlans() {
  const res = await apiFetch('/admin/api/plans');
  const data = await res.json();
  if (!data.ok) return;

  const grid = document.getElementById('plans-grid');
  grid.innerHTML = '';
  data.plans.forEach((plan) => addPlanCard(plan));
}

function addPlanCard(plan) {
  const template = document.getElementById('plan-card-template');
  const node = template.content.firstElementChild.cloneNode(true);
  const grid = document.getElementById('plans-grid');

  if (plan) {
    node.dataset.planId = plan.id;
    node.querySelector('.plan-name').value = plan.name;
    node.querySelector('.plan-is-popular').checked = plan.is_popular;
    node.querySelector('.plan-price').value = plan.price;
    node.querySelector('.plan-currency').value = plan.currency;
    node.querySelector('.plan-period').value = plan.period;
    node.querySelector('.plan-format').value = plan.format_label;
    node.querySelector('.plan-description').value = plan.description;
    node.querySelector('.plan-features').value = plan.features.join('\n');
  }

  const statusEl = node.querySelector('.plan-status');
  const saveBtn = node.querySelector('.plan-save');
  const deleteBtn = node.querySelector('.plan-delete');

  saveBtn.addEventListener('click', () => savePlanCard(node, statusEl));
  deleteBtn.addEventListener('click', () => deletePlanCard(node, statusEl));

  if (plan) {
    grid.appendChild(node);
  } else {
    grid.appendChild(node);
    node.querySelector('.plan-name').focus();
  }
}

function planCardPayload(node) {
  return {
    name: node.querySelector('.plan-name').value.trim(),
    price: node.querySelector('.plan-price').value.trim(),
    currency: node.querySelector('.plan-currency').value.trim(),
    period: node.querySelector('.plan-period').value.trim(),
    format_label: node.querySelector('.plan-format').value.trim(),
    description: node.querySelector('.plan-description').value.trim(),
    features: node.querySelector('.plan-features').value.split('\n').map((f) => f.trim()).filter(Boolean),
    is_popular: node.querySelector('.plan-is-popular').checked,
    sort_order: Number(node.dataset.planId) || Date.now(),
  };
}

async function savePlanCard(node, statusEl) {
  const payload = planCardPayload(node);
  if (!payload.name || !payload.price) {
    statusEl.textContent = 'სახელი და ფასი სავალდებულოა.';
    statusEl.className = 'form-status plan-status is-error';
    return;
  }

  const id = node.dataset.planId;
  const url = id ? `/admin/api/plans/${id}` : '/admin/api/plans';
  const method = id ? 'PUT' : 'POST';

  const res = await apiFetch(url, { method, body: JSON.stringify(payload) });
  const data = await res.json();

  if (data.ok) {
    node.dataset.planId = data.plan.id;
    statusEl.textContent = 'შენახულია.';
    statusEl.className = 'form-status plan-status is-success';
    setTimeout(() => { statusEl.textContent = ''; }, 2000);
  } else {
    statusEl.textContent = data.error || 'შეცდომა.';
    statusEl.className = 'form-status plan-status is-error';
  }
}

async function deletePlanCard(node, statusEl) {
  const id = node.dataset.planId;
  if (!id) {
    node.remove();
    return;
  }
  if (!window.confirm('წავშალო ეს პაკეტი? ის საიტიდანაც გაქრება.')) return;
  await apiFetch(`/admin/api/plans/${id}`, { method: 'DELETE' });
  node.remove();
}

// ---------------- Settings ----------------

function initSettingsPanel() {
  const form = document.getElementById('password-form');
  const status = document.getElementById('password-status');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.textContent = '';
    status.className = 'form-status';

    const res = await apiFetch('/admin/api/change-password', {
      method: 'POST',
      body: JSON.stringify({
        current_password: document.getElementById('current_password').value,
        new_password: document.getElementById('new_password').value,
      }),
    });
    const data = await res.json();

    if (data.ok) {
      status.textContent = 'პაროლი განახლდა.';
      status.classList.add('is-success');
      form.reset();
    } else {
      status.textContent = data.error || 'შეცდომა.';
      status.classList.add('is-error');
    }
  });
}
