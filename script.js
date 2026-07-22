// Ordis landing page — interactions

document.addEventListener('DOMContentLoaded', () => {
  initNavToggle();
  initFaq();
  initSignupForm();
  loadPricing();
});

function initNavToggle() {
  const toggle = document.getElementById('nav-toggle');
  const menu = document.getElementById('nav-mobile');
  if (!toggle || !menu) return;

  toggle.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.querySelector('.icon-open').hidden = isOpen;
    toggle.querySelector('.icon-close').hidden = !isOpen;
  });

  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      menu.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.querySelector('.icon-open').hidden = false;
      toggle.querySelector('.icon-close').hidden = true;
    });
  });
}

function initFaq() {
  document.querySelectorAll('.faq-item').forEach((item) => {
    const question = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');
    const iconPlus = item.querySelector('.icon-plus');
    const iconMinus = item.querySelector('.icon-minus');

    question.addEventListener('click', () => {
      const isOpen = item.classList.toggle('is-open');
      answer.style.maxHeight = isOpen ? answer.scrollHeight + 'px' : '0px';
      iconPlus.hidden = isOpen;
      iconMinus.hidden = !isOpen;
    });
  });
}

const GEORGIAN_MOBILE_RE = /^5\d{8}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function initSignupForm() {
  const form = document.getElementById('signup-form');
  if (!form) return;

  const phoneInput = document.getElementById('phone');
  const submitBtn = document.getElementById('signup-submit');
  const status = document.getElementById('signup-status');

  phoneInput.addEventListener('input', () => {
    phoneInput.value = phoneInput.value.replace(/\D/g, '').slice(0, 9);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors(form);
    status.textContent = '';
    status.className = 'form-status';

    const data = {
      first_name: form.first_name.value.trim(),
      last_name: form.last_name.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      plan: form.plan ? form.plan.value : '',
      consent: form.consent.checked,
    };

    const errors = validateSignup(data);
    if (Object.keys(errors).length) {
      showErrors(form, errors);
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'იგზავნება...';

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();

      if (res.ok && result.ok) {
        form.reset();
        status.textContent = 'მადლობა! თქვენი განაცხადი მიღებულია — მალე დაგიკავშირდებით.';
        status.classList.add('is-success');
      } else if (result.errors) {
        showErrors(form, result.errors);
      } else {
        status.textContent = 'დაფიქსირდა შეცდომა. სცადეთ ხელახლა.';
        status.classList.add('is-error');
      }
    } catch (err) {
      status.textContent = 'სერვერთან დაკავშირება ვერ მოხერხდა. სცადეთ ხელახლა.';
      status.classList.add('is-error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'განაცხადის გაგზავნა';
    }
  });
}

function validateSignup(data) {
  const errors = {};
  if (data.first_name.length < 2) errors.first_name = 'მიუთითეთ სახელი.';
  if (data.last_name.length < 2) errors.last_name = 'მიუთითეთ გვარი.';
  if (!EMAIL_RE.test(data.email)) errors.email = 'მიუთითეთ ვალიდური ელ. ფოსტა.';
  if (!GEORGIAN_MOBILE_RE.test(data.phone)) errors.phone = 'მიუთითეთ ვალიდური ქართული მობილურის ნომერი (5XXXXXXXX).';
  if (!data.consent) errors.consent = 'აუცილებელია წესებსა და პირობებზე დათანხმება.';
  return errors;
}

function showErrors(form, errors) {
  Object.entries(errors).forEach(([field, message]) => {
    const errorEl = document.getElementById(`error-${field}`);
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add('is-shown');
    }
    const input = form.querySelector(`#${field}`);
    if (input) {
      if (field === 'phone') {
        input.closest('.phone-input').classList.add('is-invalid');
      } else if (field !== 'consent') {
        input.classList.add('is-invalid');
      }
    }
  });
}

function clearErrors(form) {
  form.querySelectorAll('.field-error').forEach((el) => {
    el.textContent = '';
    el.classList.remove('is-shown');
  });
  form.querySelectorAll('.is-invalid').forEach((el) => el.classList.remove('is-invalid'));
}

const CHECK_SVG =
  '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 10.5l3.5 3.5L16 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

async function loadPricing() {
  const grid = document.getElementById('pricing-grid');
  const planSelect = document.getElementById('plan');
  if (!grid) return;

  try {
    const res = await fetch('/api/plans');
    const data = await res.json();
    if (!data.ok || !data.plans.length) {
      grid.innerHTML = '<p class="pricing-loading">ამჟამად პაკეტები არ არის ხელმისაწვდომი.</p>';
      return;
    }

    grid.innerHTML = data.plans.map(renderPlanCard).join('');

    if (planSelect) {
      planSelect.innerHTML =
        '<option value="">არ ვარ დარწმუნებული</option>' +
        data.plans.map((p) => `<option value="${escapeAttr(p.name)}">${escapeAttr(p.name)}</option>`).join('');
    }
  } catch (err) {
    grid.innerHTML = '<p class="pricing-loading">პაკეტების ჩატვირთვა ვერ მოხერხდა.</p>';
  }
}

function renderPlanCard(plan) {
  const cls = 'price-card' + (plan.is_popular ? ' price-card--popular' : '');
  const badge = plan.is_popular ? '<span class="price-badge">პოპულარული</span>' : '';
  const currency = plan.currency ? `<span class="currency">${escapeAttr(plan.currency)}</span>` : '';
  const period = plan.period ? `<span class="period">/ ${escapeAttr(plan.period)}</span>` : '';
  const formatLabel = plan.format_label ? `<p class="price-format">${escapeAttr(plan.format_label)}</p>` : '';
  const features = plan.features
    .map((f) => `<li>${CHECK_SVG}<span>${escapeAttr(f)}</span></li>`)
    .join('');
  const btnCls = plan.is_popular ? 'btn-primary' : 'btn-outline';
  const ctaLabel = plan.is_popular ? `დაიწყე ${plan.name}-ით` : 'დაიწყე უფასოდ';

  return `<div class="${cls}">
    ${badge}
    <div>
      <h3>${escapeAttr(plan.name)}</h3>
      <div class="price-line"><span class="amount">${escapeAttr(plan.price)}${currency}</span>${period}</div>
      ${formatLabel}
    </div>
    <p class="price-desc">${escapeAttr(plan.description)}</p>
    <a class="btn ${btnCls} btn-block" href="#signup">${escapeAttr(ctaLabel)}</a>
    <div>
      <p class="includes-label">რას შეიცავს:</p>
      <ul style="margin-top:0.75rem">${features}</ul>
    </div>
  </div>`;
}

function escapeAttr(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}
