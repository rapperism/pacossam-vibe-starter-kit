/* =========================================================
   내 구독료 계산기 — app.js
   로그인·서버 없이 브라우저에서만 동작합니다.
   데이터는 localStorage에 저장됩니다.
   ========================================================= */
(function () {
  'use strict';

  var STORAGE_KEY = 'subcalc.subscriptions.v1';

  var CATEGORIES = ['영상', '음악', 'AI·생산성', '클라우드', '쇼핑·멤버십', '교육', '기타'];

  var SAMPLE = [
    { name: '아이클라우드+', amount: 3300, cycle: 'month', category: '클라우드', day: 1 },
    { name: '노션 플러스', amount: 96000, cycle: 'year', category: 'AI·생산성', day: 3 },
    { name: '챗지피티 플러스', amount: 29000, cycle: 'month', category: 'AI·생산성', day: 5 },
    { name: '쿠팡 와우 멤버십', amount: 7890, cycle: 'month', category: '쇼핑·멤버십', day: 18 },
    { name: '넷플릭스', amount: 13500, cycle: 'month', category: '영상', day: 22 },
    { name: '멜론 스트리밍', amount: 10900, cycle: 'month', category: '음악', day: 25 }
  ];

  // ---------- 상태 ----------
  var state = {
    subs: [],
    filter: 'all',
    sort: 'day',
    editingId: null,
    pendingDeleteId: null
  };

  // ---------- DOM ----------
  var $ = function (id) { return document.getElementById(id); };

  var el = {
    viewList: $('view-list'),
    viewForm: $('view-form'),
    totalMonthly: $('total-monthly'),
    totalYearly: $('total-yearly'),
    summaryCount: $('summary-count'),
    topService: $('top-service'),
    remaining: $('remaining-this-month'),
    categoryBars: $('category-bars'),
    list: $('list'),
    listCount: $('list-count'),
    emptyState: $('empty-state'),
    chips: $('filter-chips'),
    sortSelect: $('sort-select'),
    form: $('sub-form'),
    formTitle: $('form-title'),
    fName: $('f-name'),
    fAmount: $('f-amount'),
    fDay: $('f-day'),
    fCategory: $('f-category'),
    eName: $('e-name'),
    eAmount: $('e-amount'),
    eDay: $('e-day'),
    fab: $('btn-add'),
    modal: $('modal'),
    toast: $('toast'),
    fileInput: $('file-input'),
    storageNote: $('storage-note')
  };

  // ---------- 저장 ----------
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data.filter(isValidRecord).map(function (item) {
        return {
          id: item.id || makeId(),
          name: String(item.name),
          amount: Number(item.amount),
          cycle: item.cycle === 'year' ? 'year' : 'month',
          category: CATEGORIES.indexOf(item.category) > -1 ? item.category : '기타',
          day: Number(item.day)
        };
      });
    } catch (err) {
      notify('저장된 데이터를 읽지 못했어요. 브라우저 저장이 막혀 있는지 확인해 주세요.');
      return [];
    }
  }

  function isValidRecord(item) {
    return item && typeof item.name === 'string' && item.name.trim() !== '' &&
      isFinite(Number(item.amount)) && Number(item.amount) > 0 &&
      isFinite(Number(item.day)) && Number(item.day) >= 1 && Number(item.day) <= 31;
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.subs));
      var now = new Date();
      el.storageNote.textContent = '자동 저장 켜짐 · 마지막 저장 ' +
        String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      return true;
    } catch (err) {
      notify('저장에 실패했어요. 시크릿 모드이거나 브라우저 저장 공간이 가득 찼을 수 있어요.');
      return false;
    }
  }

  // ---------- 계산 ----------
  function monthlyOf(sub) {
    return sub.cycle === 'year' ? sub.amount / 12 : sub.amount;
  }
  function monthlyTotal() {
    return state.subs.reduce(function (sum, s) { return sum + monthlyOf(s); }, 0);
  }
  function won(value) {
    return Math.round(value).toLocaleString('ko-KR') + '원';
  }
  function today() { return new Date(); }
  function daysInThisMonth() {
    var d = today();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  }
  function remainingThisMonth() {
    var day = today().getDate();
    return state.subs.filter(function (s) { return s.cycle === 'month' && s.day >= day; })
      .reduce(function (sum, s) { return sum + s.amount; }, 0);
  }

  // ---------- 그리기 ----------
  function render() {
    renderSummary();
    renderBars();
    renderChips();
    renderList();
    // 입력 화면에서는 숨기고, 목록이 비어 있을 때도 화면 안의 안내 버튼을 가리지 않도록 숨깁니다.
    var formOpen = !el.viewForm.hidden;
    el.fab.hidden = formOpen || state.subs.length === 0;
  }

  function renderSummary() {
    var total = monthlyTotal();
    el.totalMonthly.textContent = won(total);
    el.totalYearly.textContent = won(total * 12);
    el.summaryCount.textContent = '등록된 구독 ' + state.subs.length + '개';
    el.listCount.textContent = state.subs.length + '개';

    if (state.subs.length === 0) {
      el.topService.textContent = '-';
      el.remaining.textContent = '0원';
      return;
    }
    var top = state.subs.slice().sort(function (a, b) { return monthlyOf(b) - monthlyOf(a); })[0];
    el.topService.textContent = top.name;
    el.topService.title = won(monthlyOf(top)) + ' / 월';
    el.remaining.textContent = won(remainingThisMonth());
  }

  function renderBars() {
    el.categoryBars.innerHTML = '';
    if (state.subs.length === 0) {
      var empty = document.createElement('li');
      empty.className = 'bars-empty';
      empty.textContent = '구독을 추가하면 카테고리별 비중이 여기에 나옵니다.';
      el.categoryBars.appendChild(empty);
      return;
    }

    var totals = {};
    state.subs.forEach(function (s) {
      totals[s.category] = (totals[s.category] || 0) + monthlyOf(s);
    });
    var grand = monthlyTotal();
    var rows = Object.keys(totals).map(function (name) {
      return { name: name, value: totals[name] };
    }).sort(function (a, b) { return b.value - a.value; });

    rows.forEach(function (row) {
      var percent = grand > 0 ? Math.round((row.value / grand) * 100) : 0;
      var li = document.createElement('li');
      li.className = 'bar-row';
      li.innerHTML =
        '<div class="bar-top">' +
        '<span class="bar-name">' + escapeHtml(row.name) + '</span>' +
        '<span class="bar-value">' + won(row.value) + ' · ' + percent + '%</span>' +
        '</div>' +
        '<div class="bar-track"><div class="bar-fill' + (state.filter !== 'all' && state.filter !== row.name ? ' dim' : '') +
        '" style="width:' + Math.max(percent, 2) + '%"></div></div>';
      el.categoryBars.appendChild(li);
    });
  }

  function renderChips() {
    el.chips.innerHTML = '';
    var used = {};
    state.subs.forEach(function (s) { used[s.category] = true; });

    var all = document.createElement('button');
    all.type = 'button';
    all.className = 'chip';
    all.textContent = '전체';
    all.setAttribute('aria-pressed', String(state.filter === 'all'));
    all.addEventListener('click', function () { state.filter = 'all'; render(); });
    el.chips.appendChild(all);

    CATEGORIES.filter(function (c) { return used[c]; }).forEach(function (category) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      btn.textContent = category;
      btn.setAttribute('aria-pressed', String(state.filter === category));
      btn.addEventListener('click', function () {
        state.filter = state.filter === category ? 'all' : category;
        render();
      });
      el.chips.appendChild(btn);
    });
  }

  function visibleSubs() {
    var rows = state.subs.filter(function (s) {
      return state.filter === 'all' || s.category === state.filter;
    });
    rows.sort(function (a, b) {
      if (state.sort === 'amount') return monthlyOf(b) - monthlyOf(a);
      if (state.sort === 'name') return a.name.localeCompare(b.name, 'ko');
      return a.day - b.day;
    });
    return rows;
  }

  function renderList() {
    el.list.innerHTML = '';
    var rows = visibleSubs();
    el.emptyState.hidden = state.subs.length !== 0;
    if (state.subs.length === 0) {
      el.listCount.textContent = '0개';
      return;
    }
    el.listCount.textContent = state.filter === 'all'
      ? state.subs.length + '개'
      : state.filter + ' ' + rows.length + '개 · 전체 ' + state.subs.length + '개';

    if (rows.length === 0) {
      var none = document.createElement('li');
      none.className = 'bars-empty';
      none.style.padding = '24px 0';
      none.textContent = '이 카테고리에는 아직 구독이 없어요.';
      el.list.appendChild(none);
      return;
    }

    var todayDay = today().getDate();

    rows.forEach(function (sub) {
      var li = document.createElement('li');
      li.className = 'item';
      li.dataset.id = sub.id;

      var dueBadge = '';
      if (sub.cycle === 'month' && sub.day >= todayDay && sub.day - todayDay <= 7) {
        dueBadge = '<span class="badge-due">' + (sub.day - todayDay === 0 ? '오늘 결제' : 'D-' + (sub.day - todayDay)) + '</span>';
      }

      var monthlyNote = sub.cycle === 'year'
        ? '월 환산 ' + won(monthlyOf(sub))
        : (sub.day > daysInThisMonth() ? '이번 달은 ' + daysInThisMonth() + '일에' : '');

      li.innerHTML =
        '<span class="item-icon" aria-hidden="true">' + escapeHtml(sub.name.slice(0, 1)) + '</span>' +
        '<div>' +
        '<p class="item-name">' + escapeHtml(sub.name) + dueBadge + '</p>' +
        '<p class="item-meta">' + escapeHtml(sub.category) + ' · ' +
        (sub.cycle === 'year' ? '매년' : '매달') + ' ' + sub.day + '일 결제</p>' +
        '</div>' +
        '<div class="item-right">' +
        '<p class="item-amount">' + won(sub.amount) + (sub.cycle === 'year' ? ' /년' : '') + '</p>' +
        '<p class="item-monthly">' + monthlyNote + '</p>' +
        '<div class="item-actions">' +
        '<button type="button" class="item-btn" data-act="edit">수정</button>' +
        '<button type="button" class="item-btn danger" data-act="delete">삭제</button>' +
        '</div>' +
        '</div>';

      li.querySelector('[data-act="edit"]').addEventListener('click', function () { openForm(sub.id); });
      li.querySelector('[data-act="delete"]').addEventListener('click', function (event) {
        handleDelete(sub, event.currentTarget);
      });

      el.list.appendChild(li);
    });
  }

  // ---------- 삭제(한 번 확인) ----------
  function handleDelete(sub, button) {
    if (state.pendingDeleteId !== sub.id) {
      state.pendingDeleteId = sub.id;
      button.textContent = '정말 삭제?';
      setTimeout(function () {
        if (state.pendingDeleteId === sub.id) {
          state.pendingDeleteId = null;
          button.textContent = '삭제';
        }
      }, 3000);
      return;
    }
    state.pendingDeleteId = null;
    state.subs = state.subs.filter(function (s) { return s.id !== sub.id; });
    save();
    render();
    notify('“' + sub.name + '”을(를) 삭제했어요.');
  }

  // ---------- 화면 전환 ----------
  function showList() {
    el.viewForm.hidden = true;
    el.viewList.hidden = false;
    el.fab.hidden = false;
    window.scrollTo(0, 0);
    render();
  }

  function openForm(id) {
    state.editingId = id || null;
    el.formTitle.textContent = id ? '구독 수정' : '구독 추가';
    clearErrors();
    el.form.reset();
    document.querySelector('input[name="cycle"][value="month"]').checked = true;
    el.fCategory.value = '영상';

    if (id) {
      var sub = state.subs.filter(function (s) { return s.id === id; })[0];
      if (sub) {
        el.fName.value = sub.name;
        el.fAmount.value = String(sub.amount);
        el.fDay.value = String(sub.day);
        el.fCategory.value = sub.category;
        document.querySelector('input[name="cycle"][value="' + sub.cycle + '"]').checked = true;
      }
    }

    el.viewList.hidden = true;
    el.viewForm.hidden = false;
    el.fab.hidden = true;
    window.scrollTo(0, 0);
    el.fName.focus({ preventScroll: true });
  }

  // ---------- 입력 검사 ----------
  function clearErrors() {
    [el.eName, el.eAmount, el.eDay].forEach(function (node) { node.hidden = true; node.textContent = ''; });
    [el.fName, el.fAmount, el.fDay].forEach(function (node) { node.classList.remove('invalid'); });
  }

  function setError(input, box, message) {
    box.textContent = message;
    box.hidden = false;
    input.classList.add('invalid');
  }

  function validate() {
    clearErrors();
    var ok = true;

    var name = el.fName.value.trim();
    if (name === '') {
      setError(el.fName, el.eName, '서비스명을 입력해 주세요.');
      ok = false;
    }

    var rawAmount = el.fAmount.value.replace(/[,\s]/g, '');
    if (rawAmount === '') {
      setError(el.fAmount, el.eAmount, '금액을 입력해 주세요.');
      ok = false;
    } else if (!/^\d+$/.test(rawAmount)) {
      setError(el.fAmount, el.eAmount, '금액은 숫자만 넣어 주세요. (예: 13500)');
      ok = false;
    } else if (Number(rawAmount) <= 0) {
      setError(el.fAmount, el.eAmount, '금액은 0원보다 커야 해요.');
      ok = false;
    }

    var rawDay = el.fDay.value.trim();
    if (rawDay === '') {
      setError(el.fDay, el.eDay, '결제일을 입력해 주세요.');
      ok = false;
    } else if (!/^\d+$/.test(rawDay) || Number(rawDay) < 1 || Number(rawDay) > 31) {
      setError(el.fDay, el.eDay, '결제일은 1~31 사이 숫자만 넣어 주세요.');
      ok = false;
    }

    return ok ? {
      name: name,
      amount: Number(rawAmount),
      cycle: document.querySelector('input[name="cycle"]:checked').value,
      category: el.fCategory.value,
      day: Number(rawDay)
    } : null;
  }

  // ---------- 저장 처리 ----------
  el.form.addEventListener('submit', function (event) {
    event.preventDefault();
    var data = validate();
    if (!data) return;

    if (state.editingId) {
      state.subs = state.subs.map(function (s) {
        return s.id === state.editingId ? Object.assign({}, s, data) : s;
      });
    } else {
      state.subs.push(Object.assign({ id: makeId() }, data));
    }
    if (!save()) return;

    var message = state.editingId ? '수정했어요.' : '“' + data.name + '”을(를) 추가했어요.';
    state.editingId = null;
    showList();
    notify(message);
  });

  ['f-name', 'f-amount', 'f-day'].forEach(function (id) {
    var node = $(id);
    node.addEventListener('input', function () {
      node.classList.remove('invalid');
      var box = id === 'f-name' ? el.eName : id === 'f-amount' ? el.eAmount : el.eDay;
      box.hidden = true;
    });
  });

  // ---------- 관리 모달 ----------
  function openModal() { el.modal.hidden = false; document.body.classList.add('modal-open'); }
  function closeModal() { el.modal.hidden = true; document.body.classList.remove('modal-open'); }
  $('btn-manage').addEventListener('click', openModal);
  $('btn-modal-close').addEventListener('click', closeModal);
  el.modal.addEventListener('click', function (event) {
    if (event.target === el.modal) closeModal();
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') { closeModal(); }
  });

  // 샘플
  function loadSample() {
    state.subs = SAMPLE.map(function (s) { return Object.assign({ id: makeId() }, s); });
    save();
    render();
    notify('샘플 구독 6개를 넣었어요.');
  }
  $('btn-sample').addEventListener('click', loadSample);
  $('btn-sample-empty').addEventListener('click', loadSample);

  // 초기화
  $('btn-reset').addEventListener('click', function () {
    if (state.subs.length === 0) { notify('지울 데이터가 없어요.'); return; }
    state.subs = [];
    save();
    render();
    notify('저장된 구독을 모두 지웠어요.');
  });

  // 내보내기
  $('btn-export').addEventListener('click', function () {
    if (state.subs.length === 0) { notify('내보낼 구독이 없어요. 먼저 하나 추가해 주세요.'); return; }
    var now = new Date();
    var stamp = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    var payload = {
      app: '내 구독료 계산기',
      version: 1,
      exportedAt: now.toISOString(),
      subscriptions: state.subs
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'subscriptions-' + stamp + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    notify('백업 파일을 내려받았어요 · subscriptions-' + stamp + '.json');
  });

  // 가져오기
  $('btn-import').addEventListener('click', function () { el.fileInput.click(); });
  el.fileInput.addEventListener('change', function () {
    var file = el.fileInput.files && el.fileInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(String(reader.result));
        var rows = Array.isArray(parsed) ? parsed : parsed.subscriptions;
        if (!Array.isArray(rows)) throw new Error('형식이 다릅니다');
        var clean = rows.filter(isValidRecord).map(function (item) {
          return {
            id: makeId(),
            name: String(item.name).trim(),
            amount: Number(item.amount),
            cycle: item.cycle === 'year' ? 'year' : 'month',
            category: CATEGORIES.indexOf(item.category) > -1 ? item.category : '기타',
            day: Number(item.day)
          };
        });
        if (clean.length === 0) throw new Error('읽을 수 있는 구독이 없습니다');
        state.subs = clean;
        save();
        render();
        notify('백업 파일에서 구독 ' + clean.length + '개를 불러왔어요.');
      } catch (err) {
        notify('파일을 읽지 못했어요. 이 앱에서 내보낸 JSON 파일인지 확인해 주세요.');
      } finally {
        el.fileInput.value = '';
      }
    };
    reader.readAsText(file);
  });

  // ---------- 기타 ----------
  el.fab.addEventListener('click', function () { openForm(null); });
  $('btn-add-empty').addEventListener('click', function () { openForm(null); });
  $('btn-cancel').addEventListener('click', function () { state.editingId = null; showList(); });
  $('btn-cancel-2').addEventListener('click', function () { state.editingId = null; showList(); });
  el.sortSelect.addEventListener('change', function () {
    state.sort = el.sortSelect.value;
    renderList();
  });

  function makeId() {
    return 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  var toastTimer = null;
  function notify(message) {
    // 관리 창이 열려 있으면 창 아래 안내 줄에 그대로 보여 줍니다.
    if (!el.modal.hidden) {
      el.storageNote.textContent = message;
      el.storageNote.classList.add('is-status');
      return;
    }
    el.toast.textContent = message;
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.hidden = true; }, 3200);
  }

  // ---------- 시작 ----------
  state.subs = load();
  render();

  // 테스트에서 상태를 확인할 수 있도록 최소한만 노출합니다.
  window.__subcalc = {
    state: state,
    sample: loadSample,
    openForm: openForm,
    render: render
  };
})();
