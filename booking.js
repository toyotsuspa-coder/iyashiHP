(function () {
  'use strict';

  // Set this to the deployed Cloudflare Worker URL; never put Square credentials here.
  var API_BASE = 'https://YOUR-WORKER-SUBDOMAIN.workers.dev';
  var SQUARE_BOOKING_URL = 'https://book.squareup.com/appointments/qrmx4sel5mvql1/location/LG53TFRM3KHG9/services/KNRVRECUKLIACVTRGYYYDC4X';
  var SQUARE_ALL_BOOKING_URL = 'https://book.squareup.com/appointments/qrmx4sel5mvql1/location/LG53TFRM3KHG9/services';
  var FALLBACK_COURSE = {
    key: 'foot80',
    name: '【新規★人気No.1】足むくみ◇足つぼ20分+ヘッド60分（80分）',
    price: 8200,
    duration: 80,
    bookingDurationLabel: '1時間20分（施術80分）',
    description: '足つぼ20分とドライヘッドスパ60分のセットコースです。',
    badge: '人気No.1'
  };
  var SQUARE_EXTERNAL_COURSES = [
    {
      name: '【新規★お試し体験】頭重感・眼精疲労◇寝落ちヘッドスパ（45分）',
      price: 4000,
      bookingDurationLabel: '1時間',
      description: '空いた時間やお仕事終わりに。極上の「寝落ち」体験をしてみませんか？',
      badge: '新規お試し',
      bookingUrl: SQUARE_ALL_BOOKING_URL
    },
    {
      name: '【新規】自律神経の乱れ・不眠に◇寝落ちヘッドスパ（60分）',
      price: 6200,
      bookingDurationLabel: '1時間20分',
      description: '慢性的な疲れ/頭痛/不眠を解消したい方に！◆極上の「寝落ち」体験で脳疲労リセット◆施術後は視界も頭も驚くほどスッキリ頑張るあなたに、至福の60分を。',
      badge: '新規限定',
      bookingUrl: 'https://book.squareup.com/appointments/qrmx4sel5mvql1/location/LG53TFRM3KHG9/services/OIMXEKZPBTTACAHOMF6AVM2T'
    },
    {
      name: '足湯+足つぼ（20分）',
      price: 2000,
      bookingDurationLabel: '20分',
      description: '足から身体を温め、全身の巡りを整えます。ヘッドスパとあわせることで、深くほぐれるような体験がお楽しみいただけます。※単品利用不可。メインメニューと組み合わせて選択してください。',
      badge: 'オプション',
      bookingCta: 'メインメニューと一緒にSquareで選択する',
      bookingUrl: 'https://book.squareup.com/appointments/qrmx4sel5mvql1/location/LG53TFRM3KHG9/services/XF34TW3CBUIIR5LDK3CEHWWV'
    }
  ];

  var state = {
    step: 1,
    courses: [],
    selectedCourse: null,
    selectedDate: null,
    selectedSlot: null,
    dateOffset: 0,
    squareFallback: false,
    submitting: false,
    availabilityRequest: 0
  };

  var courseList = document.getElementById('courseList');
  var dateList = document.getElementById('dateList');
  var timeList = document.getElementById('timeList');
  var alertBox = document.getElementById('bookingAlert');
  var form = document.getElementById('bookingForm');
  var fallbackPanel = document.getElementById('bookingFallback');
  var nextCourseButton = document.querySelector('[data-next="2"]');
  var courseActions = nextCourseButton.parentElement;

  function track(name) {
    if (typeof window.gtag === 'function') {
      window.gtag('event', name);
    }
  }

  function isConfigured() {
    return API_BASE.indexOf('YOUR-WORKER') === -1;
  }

  function showAlert(message) {
    alertBox.textContent = message;
    alertBox.hidden = false;
    alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function clearAlert() {
    alertBox.hidden = true;
    alertBox.textContent = '';
  }

  function formatPrice(amount) {
    return new Intl.NumberFormat('ja-JP').format(amount) + '円';
  }

  function renderCourses() {
    courseList.innerHTML = state.courses.map(function (course) {
      var badge = course.badge || (course.key === 'foot80' ? '人気No.1' : 'おすすめ');
      var selected = state.selectedCourse && state.selectedCourse.key === course.key;
      var duration = course.bookingDurationLabel || Number(course.duration) + '分';
      var description = course.description ||
        (course.key === 'foot80' ? FALLBACK_COURSE.description : '');
      var inputId = 'booking-course-' + escapeHtml(course.key);
      return '<div class="booking-course booking-course-featured' + (selected ? ' is-selected' : '') + '">' +
        '<input id="' + inputId + '" type="radio" name="course" value="' + escapeHtml(course.key) + '"' +
        (selected ? ' checked' : '') + '>' +
        '<label class="booking-course-body" for="' + inputId + '">' +
        '<span class="booking-course-badge">' + escapeHtml(badge) + '</span>' +
        '<span class="booking-course-name">' + escapeHtml(course.name) + '</span>' +
        (description ? '<span class="booking-course-description">' + escapeHtml(description) + '</span>' : '') +
        '<span class="booking-course-meta"><strong>' + formatPrice(course.price) + '</strong><span>' +
        escapeHtml(duration) + '</span></span>' +
        '</label>' +
        (state.squareFallback && course.key === 'foot80'
          ? '<a class="btn solid booking-course-square-link" href="' + SQUARE_BOOKING_URL +
            '" target="_blank" rel="noopener noreferrer">このコースで日時を選択する</a>'
          : '') +
        '</div>';
    }).join('') + SQUARE_EXTERNAL_COURSES.map(function (course) {
      return '<div class="booking-course booking-course-featured booking-course-external">' +
        '<div class="booking-course-body">' +
        '<span class="booking-course-badge">' + escapeHtml(course.badge) + '</span>' +
        '<span class="booking-course-name">' + escapeHtml(course.name) + '</span>' +
        '<span class="booking-course-description">' + escapeHtml(course.description) + '</span>' +
        '<span class="booking-course-meta"><strong>' + formatPrice(course.price) + '</strong><span>' +
        escapeHtml(course.bookingDurationLabel) + '</span></span>' +
        '</div>' +
        '<a class="btn solid booking-course-square-link" href="' + course.bookingUrl +
        '" target="_blank" rel="noopener noreferrer">' +
        escapeHtml(course.bookingCta || 'このコースをSquareで予約する') + '</a>' +
        '</div>';
    }).join('');

    courseList.querySelectorAll('input[name="course"]').forEach(function (input) {
      input.addEventListener('change', function () {
        state.selectedCourse = state.courses.find(function (course) {
          return course.key === input.value;
        });
        courseList.querySelectorAll('.booking-course').forEach(function (card) {
          card.classList.toggle('is-selected', card.contains(input));
        });
        nextCourseButton.disabled = !state.selectedCourse;
        clearAlert();
        track('booking_course_select');
      });
    });

    courseList.querySelectorAll('.booking-course-square-link').forEach(function (link) {
      link.addEventListener('click', function () {
        track('booking_course_select');
        track('booking_submit');
      }, { once: true });
    });
  }

  function showSquareFallback(message) {
    state.courses = [FALLBACK_COURSE];
    state.selectedCourse = FALLBACK_COURSE;
    state.squareFallback = true;
    renderCourses();
    fallbackPanel.hidden = false;
    courseActions.hidden = true;
    var squareAllLink = fallbackPanel.querySelector('a');
    squareAllLink.href = SQUARE_ALL_BOOKING_URL;
    squareAllLink.addEventListener('click', function () {
      track('booking_course_select');
      track('booking_submit');
    });
    if (message) showAlert(message);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot')
      .replace(/'/g, '&#39;');
  }

  function formatJstDate(date) {
    var parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date);
    var values = {};
    parts.forEach(function (part) { values[part.type] = part.value; });
    return values.year + '-' + values.month + '-' + values.day;
  }

  function dateFromJstString(value) {
    var parts = value.split('-').map(Number);
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 0, 0, 0));
  }

  function addDays(value, days) {
    var date = dateFromJstString(value);
    date.setUTCDate(date.getUTCDate() + days);
    return formatJstDate(date);
  }

  function getTodayJst() {
    return formatJstDate(new Date());
  }

  function setStep(step) {
    state.step = step;
    document.querySelectorAll('[data-step-indicator]').forEach(function (item) {
      var itemStep = Number(item.getAttribute('data-step-indicator'));
      item.classList.toggle('is-active', itemStep === step);
      item.classList.toggle('is-complete', itemStep < step);
    });
    document.querySelectorAll('[data-booking-panel]').forEach(function (panel) {
      panel.hidden = Number(panel.getAttribute('data-booking-panel')) !== step;
    });
  }

  async function api(path, options) {
    var response = await fetch(API_BASE + path, options);
    var data;
    try {
      data = await response.json();
    } catch (error) {
      throw new Error('サーバーから正しい応答を受け取れませんでした。');
    }
    if (!response.ok) {
      var error = new Error(data.message || '予約を処理できませんでした。');
      error.status = response.status;
      throw error;
    }
    return data;
  }

  async function loadCourses() {
    if (!isConfigured()) {
      showSquareFallback();
      return;
    }
    try {
      var data = await api('/api/services');
      state.courses = (data.services || []).filter(function (course) {
        return course.key === 'foot80';
      });
      if (!state.courses.length) {
        showSquareFallback('コースを取得できませんでした。Square予約をご利用ください。');
        return;
      }
      state.squareFallback = false;
      state.selectedCourse = null;
      renderCourses();
      fallbackPanel.hidden = true;
      courseActions.hidden = false;
      nextCourseButton.disabled = true;
    } catch (error) {
      showSquareFallback('コースを読み込めませんでした。Square予約をご利用ください。');
    }
  }

  function renderDates() {
    var today = getTodayJst();
    var startDate = addDays(today, state.dateOffset * 7);
    var endDate = addDays(startDate, 6);
    document.getElementById('weekLabel').textContent =
      startDate.replace(/-/g, '.') + ' - ' + endDate.replace(/-/g, '.');
    document.getElementById('previousWeek').disabled = state.dateOffset <= 0;

    var html = '';
    for (var i = 0; i < 7; i += 1) {
      var date = addDays(startDate, i);
      var dateObj = dateFromJstString(date);
      var weekday = new Intl.DateTimeFormat('ja-JP', { timeZone: 'UTC', weekday: 'short' }).format(dateObj);
      var day = dateObj.getUTCDate();
      var selected = state.selectedDate === date;
      html += '<button type="button" class="booking-date' + (selected ? ' is-selected' : '') +
        '" data-date="' + date + '" aria-pressed="' + (selected ? 'true' : 'false') + '">' +
        '<span>' + weekday + '</span><strong>' + day + '</strong></button>';
    }
    dateList.innerHTML = html;
    dateList.querySelectorAll('[data-date]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.selectedDate = button.getAttribute('data-date');
        state.selectedSlot = null;
        renderDates();
        loadAvailability();
        track('booking_date_select');
      });
    });
  }

  async function loadAvailability() {
    if (!state.selectedCourse || !state.selectedDate) return;
    if (!isConfigured()) return;
    state.selectedSlot = null;
    var requestId = ++state.availabilityRequest;
    timeList.innerHTML = '<p class="booking-loading">空き時間を確認しています...</p>';
    timeList.setAttribute('aria-busy', 'true');
    document.querySelector('[data-next="3"]').disabled = true;
    try {
      var data = await api('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceKey: state.selectedCourse.key,
          date: state.selectedDate
        })
      });
      if (requestId !== state.availabilityRequest) return;
      var slots = data.slots || [];
      if (!slots.length) {
        timeList.innerHTML = '<p class="booking-empty">この日は空きがありません。別の日をお選びください。</p>';
        return;
      }
      timeList.innerHTML = slots.map(function (slot) {
        return '<button type="button" class="booking-time" data-start="' +
          escapeHtml(slot.startAt) + '" data-team="' + escapeHtml(slot.teamMemberId || '') +
          '" aria-pressed="false">' + escapeHtml(slot.label) + '</button>';
      }).join('');
      timeList.querySelectorAll('.booking-time').forEach(function (button) {
        button.addEventListener('click', function () {
          timeList.querySelectorAll('.booking-time').forEach(function (item) {
            item.classList.remove('is-selected');
            item.setAttribute('aria-pressed', 'false');
          });
          button.classList.add('is-selected');
          button.setAttribute('aria-pressed', 'true');
          state.selectedSlot = {
            startAt: button.getAttribute('data-start'),
            teamMemberId: button.getAttribute('data-team') || undefined
          };
          document.querySelector('[data-next="3"]').disabled = false;
          clearAlert();
          track('booking_time_select');
        });
      });
    } catch (error) {
      if (requestId !== state.availabilityRequest) return;
      timeList.innerHTML = '<p class="booking-empty">空き時間を取得できませんでした。</p>';
      showAlert(error.message);
    } finally {
      if (requestId === state.availabilityRequest) {
        timeList.setAttribute('aria-busy', 'false');
      }
    }
  }

  function updateSummary() {
    if (!state.selectedCourse || !state.selectedSlot) return;
    var start = state.selectedSlot.startAt;
    var label = start.match(/T(\d{2}:\d{2})/) ? start.match(/T(\d{2}:\d{2})/)[1] : '';
    document.getElementById('bookingSummary').innerHTML =
      '<dl>' +
      '<div><dt>コース</dt><dd>' + escapeHtml(state.selectedCourse.name) + '</dd></div>' +
      '<div><dt>日時</dt><dd>' + escapeHtml(state.selectedDate) + ' ' + escapeHtml(label) + '</dd></div>' +
      '<div><dt>料金</dt><dd>' + formatPrice(state.selectedCourse.price) + '</dd></div>' +
      '</dl>';
  }

  document.querySelectorAll('[data-next]').forEach(function (button) {
    button.addEventListener('click', function () {
      var next = Number(button.getAttribute('data-next'));
      if (next === 2) {
        renderDates();
      }
      if (next === 3) {
        updateSummary();
        track('booking_form_start');
      }
      setStep(next);
      clearAlert();
    });
  });

  document.querySelectorAll('[data-back]').forEach(function (button) {
    button.addEventListener('click', function () {
      setStep(Number(button.getAttribute('data-back')));
      clearAlert();
    });
  });

  document.getElementById('previousWeek').addEventListener('click', function () {
    if (state.dateOffset <= 0) return;
    state.dateOffset -= 1;
    state.selectedDate = null;
    state.selectedSlot = null;
    state.availabilityRequest += 1;
    timeList.innerHTML = '<p class="booking-empty">日付を選んでください。</p>';
    timeList.setAttribute('aria-busy', 'false');
    document.querySelector('[data-next="3"]').disabled = true;
    renderDates();
  });

  document.getElementById('nextWeek').addEventListener('click', function () {
    state.dateOffset += 1;
    state.selectedDate = null;
    state.selectedSlot = null;
    state.availabilityRequest += 1;
    timeList.innerHTML = '<p class="booking-empty">日付を選んでください。</p>';
    timeList.setAttribute('aria-busy', 'false');
    document.querySelector('[data-next="3"]').disabled = true;
    renderDates();
  });

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (state.submitting) return;
    clearAlert();
    var formData = new FormData(form);
    var name = String(formData.get('name') || '').trim();
    var phone = String(formData.get('phone') || '').trim();
    var email = String(formData.get('email') || '').trim();
    if (!name || !phone) {
      showAlert('お名前と電話番号は必須です。');
      track('booking_error');
      return;
    }
    if (!state.selectedCourse || !state.selectedSlot) {
      showAlert('コースと予約日時を選択してください。');
      track('booking_error');
      return;
    }

    state.submitting = true;
    var submitButton = form.querySelector('.booking-submit');
    submitButton.disabled = true;
    submitButton.textContent = '予約を送信中...';
    track('booking_submit');

    var idempotencyKey;
    try {
      idempotencyKey = window.crypto && window.crypto.randomUUID
        ? window.crypto.randomUUID()
        : 'iyasis-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      var data = await api('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: idempotencyKey,
          serviceKey: state.selectedCourse.key,
          startAt: state.selectedSlot.startAt,
          teamMemberId: state.selectedSlot.teamMemberId,
          name: name,
          phone: phone,
          email: email
        })
      });
      if (!data.ok) {
        var bookingError = new Error(data.message || '予約を確定できませんでした。');
        bookingError.status = 500;
        throw bookingError;
      }
      document.querySelectorAll('[data-step-indicator]').forEach(function (item) {
        item.classList.remove('is-active');
        item.classList.add('is-complete');
      });
      document.querySelectorAll('[data-booking-panel]').forEach(function (panel) {
        panel.hidden = true;
      });
      var completePanel = document.querySelector('[data-booking-panel="complete"]');
      completePanel.hidden = false;
      document.getElementById('successMessage').textContent =
        state.selectedDate + ' ' +
        (state.selectedSlot.startAt.match(/T(\d{2}:\d{2})/) || ['', ''])[1] +
        '／' + state.selectedCourse.name + ' のご予約をSquareに登録しました。';
      track('booking_complete');
    } catch (error) {
      if (error.status === 409) {
        state.selectedSlot = null;
        document.querySelector('[data-next="3"]').disabled = true;
        loadAvailability();
        showAlert('申し訳ございません。この時間枠は埋まりました。最新の空き時間を表示しますので、別の時間をお選びください。');
      } else {
        showAlert(error.message || '予約を確定できませんでした。時間をおいて再度お試しください。');
      }
      track('booking_error');
    } finally {
      state.submitting = false;
      submitButton.disabled = false;
      submitButton.textContent = '予約を確定する';
    }
  });

  loadCourses();
})();
