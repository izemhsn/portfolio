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
