const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------
   Mobile menu
   ------------------------------------------------------------ */
(() => {
  const menuButton = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('.site-nav');
  const menuLabel = document.querySelector('.menu-label');
  const background = [document.querySelector('.brand'), document.querySelector('#main')];

  function closeMenu(restoreFocus = false) {
    menuButton.setAttribute('aria-expanded', 'false');
    navigation.classList.remove('is-open');
    menuLabel.textContent = 'Menu';
    document.body.style.overflow = '';
    background.forEach((el) => { el.inert = false; });
    if (restoreFocus) menuButton.focus();
  }

  function openMenu() {
    menuButton.setAttribute('aria-expanded', 'true');
    navigation.classList.add('is-open');
    menuLabel.textContent = 'Close';
    document.body.style.overflow = 'hidden';
    background.forEach((el) => { el.inert = true; });
    navigation.querySelector('a').focus();
  }

  menuButton.addEventListener('click', () => {
    if (menuButton.getAttribute('aria-expanded') === 'true') closeMenu();
    else openMenu();
  });

  navigation.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => closeMenu()));

  document.addEventListener('keydown', (event) => {
    if (!navigation.classList.contains('is-open')) return;
    if (event.key === 'Escape') return closeMenu(true);
    if (event.key !== 'Tab') return;

    const focusable = [menuButton, ...navigation.querySelectorAll('a')];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  window.matchMedia('(min-width: 981px)').addEventListener('change', (event) => {
    if (event.matches && navigation.classList.contains('is-open')) closeMenu();
  });
})();

/* ------------------------------------------------------------
   Header: turns into a solid bar once the page scrolls
   ------------------------------------------------------------ */
(() => {
  const header = document.querySelector('.site-header');
  let ticking = false;
  const update = () => {
    header.classList.toggle('is-stuck', window.scrollY > 24);
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }, { passive: true });
  // Wait a frame: reading scrollY now would force an early layout during load.
  requestAnimationFrame(update);
})();

/* ------------------------------------------------------------
   Kitchen Monitor demo
   Orders tick up in age, change colour as they wait, and can be
   marked done. A new order arrives every few seconds until paused.
   ------------------------------------------------------------ */
(() => {
  const kds = document.querySelector('.kds');
  if (!kds) return;

  const list = kds.querySelector('.kds-orders');
  const openCount = kds.querySelector('.kds-open');
  const pauseBtn = kds.querySelector('.kds-pause');
  // Screen readers hear only what the user did. The demo adds and bumps orders on
  // its own every few seconds, and announcing each of those would be constant noise.
  const status = document.querySelector('.kds-status');

  const MAX_ORDERS = 4;
  const CYCLE_MS = 6500;

  const POOL = [
    { where: 'Table 3', items: ['1× Chicken tagine', '2× Mint tea'] },
    { where: 'Pickup', items: ['2× Cheeseburger', '2× Fries'] },
    { where: 'Online, pickup', items: ['1× Veggie bowl', '1× Iced coffee'] },
    { where: 'QR, table 8', items: ['2× Harira soup', '1× Bread basket'] },
    { where: 'Kiosk', items: ['1× Smash burger', '1× Cola'] },
    { where: 'Online, delivery', items: ['3× Margherita', '1× Tiramisu'] },
    { where: 'Table 11', items: ['1× Caesar salad', '1× Lemonade'] },
    { where: 'Kiosk', items: ['2× Chicken wrap', '1× Fries'] },
  ];

  let orders = [
    { id: 214, where: 'Table 5', items: ['2× Smash burger', '1× Fries, no salt', '1× Mint tea'], age: 522 },
    { id: 215, where: 'Pickup', items: ['1× Chicken wrap', '1× Lemonade'], age: 250 },
    { id: 216, where: 'QR, table 12', items: ['3× Mint tea', '2× Msemen'], age: 95 },
    { id: 217, where: 'Online, delivery', items: ['2× Margherita', '1× Caesar salad'], age: 20 },
  ];
  let nextId = 218;
  let poolIndex = 0;
  let paused = reduceMotion;
  let inView = false;

  const stateFor = (o) => (o.done ? 'done' : o.age >= 420 ? 'late' : o.age >= 180 ? 'cooking' : 'new');
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  function build(o, isNew) {
    const li = el('li', 'order' + (isNew && !reduceMotion ? ' is-new' : ''));
    const btn = el('button', 'order-btn');
    btn.type = 'button';

    // The visible text names the button; a hidden suffix says what pressing it does.
    const head = el('span', 'order-head');
    head.append(el('span', null, `#${o.id}`), el('span', 'order-time', fmt(o.age)));
    const items = el('span', 'order-items');
    o.items.forEach((t) => items.append(el('span', null, t)));
    btn.append(head, el('span', 'order-where', o.where), items, el('span', 'sr-only', ', mark as done'));
    btn.addEventListener('click', () => complete(o, true));

    li.append(btn);
    li.dataset.state = stateFor(o);
    o.node = li;
    return li;
  }

  function refresh(o) {
    o.node.dataset.state = stateFor(o);
    if (o.done) o.node.querySelector('.order-btn').setAttribute('aria-disabled', 'true');
    o.node.querySelector('.order-time').textContent = o.done ? 'Done' : fmt(o.age);
  }

  function updateCount() {
    openCount.textContent = `${orders.filter((o) => !o.done).length} open`;
  }

  function addOrder() {
    if (orders.length >= MAX_ORDERS) return;
    const base = POOL[poolIndex++ % POOL.length];
    const o = { id: nextId++, where: base.where, items: base.items, age: 0 };
    orders.push(o);
    list.append(build(o, true));
    updateCount();
  }

  function complete(o, byUser) {
    if (o.done) return;
    o.done = true;
    refresh(o);
    updateCount();
    if (byUser && status) status.textContent = `Order #${o.id} marked done. ${orders.filter((x) => !x.done).length} open.`;

    setTimeout(() => {
      const remove = () => {
        // Keep keyboard focus inside the demo when the bumped order leaves.
        const hadFocus = o.node.contains(document.activeElement);
        o.node.remove();
        orders = orders.filter((x) => x !== o);
        if (hadFocus) (list.querySelector('.order-btn') || pauseBtn).focus();
        // A fresh order follows a user's bump, even while paused.
        if (byUser) setTimeout(addOrder, 900);
      };
      if (reduceMotion) return remove();
      o.node.classList.add('is-leaving');
      o.node.addEventListener('animationend', remove, { once: true });
    }, 900);
  }

  function cycle() {
    if (paused || !inView || document.hidden) return;
    const oldest = orders.find((o) => !o.done);
    if (orders.length >= MAX_ORDERS && oldest) {
      complete(oldest, false);
      setTimeout(addOrder, 1800);
    } else {
      addOrder();
    }
  }

  function tick() {
    if (paused || !inView || document.hidden) return;
    orders.forEach((o) => {
      if (o.done) return;
      o.age += 1;
      refresh(o);
    });
  }

  function setPaused(value) {
    paused = value;
    pauseBtn.setAttribute('aria-pressed', String(paused));
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    kds.classList.toggle('is-paused', paused);
  }

  // Replace the static fallback markup with the live version.
  list.replaceChildren(...orders.map((o) => build(o, false)));
  updateCount();
  setPaused(paused);
  pauseBtn.addEventListener('click', () => setPaused(!paused));

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; }).observe(kds);
  } else {
    inView = true;
  }

  setInterval(tick, 1000);
  setInterval(cycle, CYCLE_MS);
})();

/* ------------------------------------------------------------
   Small helpers for the demos below
   ------------------------------------------------------------ */
// Restart a one-shot CSS animation class (e.g. a laser sweep) on an element.
// With `until`, the class is dropped once that animation ends (on the element or a
// child), so the resting state comes back (e.g. the Price Check laser line).
function replay(el, cls, until) {
  if (reduceMotion) return;
  el.classList.remove(cls);
  void el.offsetWidth; // force a reflow so the animation starts again
  el.classList.add(cls);
  if (!until) return;
  const done = (event) => {
    if (event.animationName !== until) return;
    el.classList.remove(cls);
    el.removeEventListener('animationend', done);
  };
  el.addEventListener('animationend', done);
}

/* ------------------------------------------------------------
   Admin portal demo: tabs switch the table
   ------------------------------------------------------------ */
(() => {
  const tabs = [...document.querySelectorAll('.admin-tabs [role="tab"]')];
  const panel = document.querySelector('#admin-rows');
  if (!tabs.length || !panel) return;

  // [first column, status, last column, status is a warning?]
  const DATA = {
    orders: [['#1042', 'Paid', '84.50'], ['#1041', 'Paid', '27.00'], ['#1040', 'Open', '112.90', true], ['#1039', 'Paid', '46.20'], ['#1038', 'Paid', '63.75']],
    invoices: [['INV-318', 'Paid', '1,240.00'], ['INV-317', 'Due', '389.00', true], ['INV-316', 'Paid', '912.50'], ['INV-315', 'Paid', '2,075.00'], ['INV-314', 'Paid', '640.00']],
    users: [['Sara K.', 'Owner', 'Today'], ['Youssef A.', 'Manager', 'Today'], ['Lena M.', 'Cashier', 'Yesterday'], ['Tom B.', 'Kitchen', '2 days'], ['New user', 'Invited', '—', true]],
  };

  function select(tab, moveFocus) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    if (moveFocus) tab.focus();
    panel.setAttribute('aria-labelledby', tab.id);
    panel.replaceChildren(...DATA[tab.dataset.tab].map(([a, status, c, warn], i) => {
      const row = document.createElement('p');
      row.style.setProperty('--i', i);
      const s = document.createElement('span');
      s.textContent = status;
      if (warn) s.className = 'is-warn';
      const first = document.createElement('span');
      first.textContent = a;
      const last = document.createElement('b');
      last.textContent = c;
      row.append(first, s, last);
      return row;
    }));
    replay(panel, 'is-switching');
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab, false));
    // Arrow keys move between tabs (the standard tablist pattern).
    tab.addEventListener('keydown', (event) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        select(tabs[event.key === 'Home' ? 0 : tabs.length - 1], true);
      } else if (step) {
        event.preventDefault();
        select(tabs[(i + step + tabs.length) % tabs.length], true);
      }
    });
  });
})();

/* ------------------------------------------------------------
   Web POS cashier demo: tap items to build an order, then pay
   ------------------------------------------------------------ */
(() => {
  const items = [...document.querySelectorAll('.cashier-items button')];
  const lines = document.querySelector('.cashier-lines');
  const pay = document.querySelector('.cashier-pay');
  const status = document.querySelector('.cashier-status');
  if (!items.length || !lines || !pay || !status) return;

  // Keyed by data-name, not the label text, so whitespace or markup in a button can't break the lookup.
  const PRICES = new Map(items.map((b) => [b.dataset.name, Number(b.dataset.price)]));
  const price = (name) => PRICES.get(name) || 0;
  const money = (n) => n.toFixed(2);
  // Starts with the same order the static markup shows.
  let order = new Map([['Burger', 2], ['Fries', 1], ['Cola', 2]]);
  let paying = false;
  // Items tapped while "Paid" is showing go into the next order instead of being dropped.
  let queued = [];

  const total = () => [...order].reduce((sum, [name, qty]) => sum + qty * price(name), 0);

  function render(changed) {
    const rows = [...order].map(([name, qty]) => {
      const li = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = `${qty} × ${name}`;
      const amount = document.createElement('b');
      amount.textContent = money(qty * price(name));
      li.append(label, amount);
      if (name === changed && !reduceMotion) li.classList.add('is-new');
      return li;
    });
    if (!rows.length) {
      const empty = document.createElement('li');
      empty.className = 'is-empty';
      empty.textContent = 'Tap an item to start';
      rows.push(empty);
    }
    lines.replaceChildren(...rows);
    pay.textContent = order.size ? `Pay ${money(total())}` : 'Pay';
    pay.setAttribute('aria-disabled', String(!order.size));
  }

  items.forEach((button) => button.addEventListener('click', () => {
    const name = button.dataset.name;
    if (paying) {
      queued.push(name);
      status.textContent = `${name} added to the next order.`;
      return;
    }
    order.set(name, (order.get(name) || 0) + 1);
    render(name);
    status.textContent = `${name} added. Total ${money(total())}.`;
  }));

  pay.addEventListener('click', () => {
    if (paying) return;
    if (!order.size) {
      status.textContent = 'The order is empty. Add an item first.';
      return;
    }
    paying = true;
    const paid = money(total());
    pay.textContent = `Paid ${paid} ✓`;
    pay.classList.add('is-paid');
    status.textContent = `Paid ${paid}. Starting a new order.`;
    setTimeout(() => {
      order = new Map();
      queued.forEach((name) => order.set(name, (order.get(name) || 0) + 1));
      const last = queued[queued.length - 1];
      queued = [];
      pay.classList.remove('is-paid');
      paying = false;
      render(last);
    }, 1400);
  });
})();

/* ------------------------------------------------------------
   Event Scanner demo: tap the code to scan the next ticket
   ------------------------------------------------------------ */
(() => {
  const button = document.querySelector('.ph-frame');
  const result = document.querySelector('.ph-result');
  const title = result?.querySelector('strong');
  const ticket = result?.querySelector('.ph-ticket');
  const icon = result?.querySelector('path');
  const count = document.querySelector('.ph-count strong');
  if (!button || !result || !title || !ticket || !icon || !count) return;
  let scanned = 1284;
  let step = 0;
  let nextTicket = 4472;
  let nextStand = 0;
  // Tickets currently inside the venue, oldest first. 4471 is the one the markup shows.
  const inside = [{ id: 4471, where: 'Main stand' }];

  // The gate keeps a running list, as a real one would: new tickets check in, a
  // ticket that's already inside is rejected, and the oldest one checks out.
  const PATTERN = ['in', 'in', 'dup', 'out', 'in'];
  const STANDS = ['East stand', 'Main stand', 'VIP lounge', 'North stand'];
  const LABEL = { in: 'Checked in', dup: 'Already checked in', out: 'Checked out' };
  const ICON = { in: 'M4.5 10.5l3.5 3.5 7.5-8', out: 'M4.5 10.5l3.5 3.5 7.5-8', dup: 'M5.5 5.5l9 9M14.5 5.5l-9 9' };

  function nextScan() {
    let state = PATTERN[step++ % PATTERN.length];
    // Repeat and check-out need someone inside; otherwise it's a fresh check-in.
    if (state !== 'in' && inside.length < 2) state = 'in';
    if (state === 'in') {
      const t = { id: nextTicket++, where: STANDS[nextStand++ % STANDS.length] };
      inside.push(t);
      return { state, ...t };
    }
    if (state === 'dup') return { state, ...inside[inside.length - 1] };
    return { state, ...inside.shift() };
  }

  button.addEventListener('click', () => {
    const scan = nextScan();
    scanned += 1; // every scan counts, including repeats and check-outs
    replay(button, 'is-scanning', 'laser');
    result.dataset.state = scan.state;
    title.textContent = LABEL[scan.state];
    ticket.textContent = `Ticket ${scan.id}, ${scan.where}`;
    icon.setAttribute('d', ICON[scan.state]);
    count.textContent = scanned.toLocaleString('en-US');
    replay(result, 'is-new');
  });
})();

/* ------------------------------------------------------------
   Price Check demo: tap the barcode to scan the next product
   ------------------------------------------------------------ */
(() => {
  const button = document.querySelector('.price-scan');
  const result = document.querySelector('.price-result');
  const ean = button?.querySelector('.price-ean');
  const name = result?.querySelector('.price-name');
  const price = result?.querySelector('.price-value');
  if (!button || !result || !ean || !name || !price) return;
  let next = 1;

  const PRODUCTS = [
    { ean: '4 012345 678901', name: 'Iced tea 0.5 L', price: '2.90' },
    { ean: '4 012345 102938', name: 'Espresso beans 1 kg', price: '18.90' },
    { ean: '4 012345 554433', name: 'Dark chocolate 100 g', price: '1.49' },
    { ean: '4 012345 870021', name: 'Sparkling water 1 L', price: '0.79' },
  ];

  button.addEventListener('click', () => {
    const p = PRODUCTS[next++ % PRODUCTS.length];
    replay(button, 'is-scanning', 'laser');
    ean.textContent = p.ean;
    name.textContent = p.name;
    price.textContent = p.price;
    replay(result, 'is-new');
  });
})();

/* ------------------------------------------------------------
   Scroll reveal and count-up numbers
   ------------------------------------------------------------ */
(() => {
  if (reduceMotion || !('IntersectionObserver' in window)) return;

  // Count the big numbers up from zero the first time they're seen. Screen readers
  // get the final value straight away; only the visible copy animates.
  const counters = [...document.querySelectorAll('.impact-grid strong')].map((el) => {
    const text = el.textContent.trim();
    const match = text.match(/^(\d+)(.*)$/);
    if (!match) return null;
    const visible = document.createElement('span');
    visible.setAttribute('aria-hidden', 'true');
    visible.textContent = `0${match[2]}`;
    const real = document.createElement('span');
    real.className = 'sr-only';
    real.textContent = text;
    el.replaceChildren(visible, real);
    return { el, visible, target: Number(match[1]), suffix: match[2] };
  }).filter(Boolean);

  function countUp({ visible, target, suffix }, instant) {
    if (instant) {
      visible.textContent = `${target}${suffix}`;
      return;
    }
    const start = performance.now();
    const DURATION = 1100;
    const frame = (now) => {
      const t = Math.min(1, (now - start) / DURATION);
      const eased = 1 - (1 - t) ** 3;
      visible.textContent = `${Math.round(target * eased)}${suffix}`;
      if (t < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  const targets = document.querySelectorAll([
    'main > .section .section-heading > *',
    '.lede-points li',
    '.group-heading',
    '.group-note',
    '.row',
    '.project',
    '.impact-grid li',
    '.xtremio-detail',
    '.site',
    '.skills > div',
    '.background > div',
  ].join(','));

  const pending = new Set(targets);

  // Reveal an element. `instant` skips the fade: used when a link jumps to it, so
  // the browser scrolls to its real position (not 28px lower) and the row's
  // "called" flash isn't playing on a half-transparent row.
  function show(el, instant) {
    if (!pending.delete(el)) return;
    observer?.unobserve(el);
    if (instant) {
      el.style.transition = 'none';
      el.classList.add('is-visible');
      void el.offsetWidth; // apply the end state before the transition comes back
      el.style.transition = '';
    } else {
      el.classList.add('is-visible');
    }
    // Drop the stagger once it's in, so it doesn't delay anything later.
    setTimeout(() => { el.style.transitionDelay = ''; }, instant ? 0 : 1500);
    const counter = counters.find((c) => el.contains(c.el));
    if (counter) countUp(counter, instant);
  }

  // Before a jump to #id, show that element and anything around it that's still hidden.
  function showTarget(hash) {
    let target = null;
    try { target = hash.length > 1 ? document.querySelector(decodeURIComponent(hash)) : null; } catch { /* not a valid selector */ }
    if (!target) return;
    pending.forEach((el) => { if (el === target || el.contains(target)) show(el, true); });
  }

  // Elements already on screen when this runs were painted visible, so leave them
  // be. Hiding them now would make them flash and fade back in.
  const onScreen = new Set([...targets].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight;
  }));

  document.documentElement.classList.add('js-reveal');
  let observer = null;
  targets.forEach((el) => {
    el.classList.add('reveal');
    // Stagger siblings a little, but never by more than a few steps.
    const i = Math.min([...el.parentElement.children].indexOf(el), 5);
    el.style.transitionDelay = `${i * 70}ms`;
  });
  onScreen.forEach((el) => show(el, true));
  showTarget(location.hash); // opened on an address like /#price-check

  observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => { if (entry.isIntersecting) show(entry.target, false); });
  }, { rootMargin: '0px 0px -8% 0px' });
  pending.forEach((el) => observer.observe(el));

  // In-page links (nav, project names, "skip to content") and back/forward.
  // The capture-phase click runs before the browser scrolls to the target.
  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('a[href^="#"]');
    if (link) showTarget(link.getAttribute('href'));
  }, true);
  window.addEventListener('hashchange', () => showTarget(location.hash));

  // Printing or saving as PDF: show everything, with the final numbers.
  window.addEventListener('beforeprint', () => { [...pending].forEach((el) => show(el, true)); });
})();

/* ------------------------------------------------------------
   Copy-email button next to the contact email
   ------------------------------------------------------------ */
(() => {
  const link = document.querySelector('.contact-actions a[href^="mailto:"]');
  if (!link || !navigator.clipboard) return;

  const email = link.getAttribute('href').replace('mailto:', '');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'copy-email';
  button.textContent = 'Copy email';
  const status = document.createElement('span');
  status.className = 'sr-only';
  status.setAttribute('aria-live', 'polite');
  link.after(button, status);

  let timer;
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(email);
      button.textContent = 'Copied';
      status.textContent = `${email} copied to the clipboard.`;
    } catch {
      button.textContent = 'Copy failed';
      status.textContent = 'Copying failed. Select the email address to copy it.';
    }
    clearTimeout(timer);
    timer = setTimeout(() => { button.textContent = 'Copy email'; status.textContent = ''; }, 2200);
  });
})();

/* ------------------------------------------------------------
   Footer: year and local time in Morocco
   ------------------------------------------------------------ */
(() => {
  const timeEl = document.querySelector('#local-time');
  const yearEl = document.querySelector('#year');
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Casablanca',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const update = () => { timeEl.textContent = fmt.format(new Date()); };
  yearEl.textContent = new Date().getFullYear();
  update();
  setInterval(update, 30000);
})();
