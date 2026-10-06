(() => {
  'use strict';

  const keyPattern = /^\d{4}-\d{2}-\d{2}$/;
  const pad = (number) => String(number).padStart(2, '0');
  const keyFor = (year, month, day) => `${year}-${pad(month + 1)}-${pad(day)}`;

  function monthFromKey(key) {
    if (!keyPattern.test(key)) return null;
    const [year, month] = key.split('-').map(Number);
    return Number.isInteger(year) && month >= 1 && month <= 12 ? { year, month: month - 1 } : null;
  }

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  /**
   * getDays returns an iterable of YYYY-MM-DD keys with saved content.
   * getSelectedDate and getToday return local YYYY-MM-DD keys.
   * onSelect receives a YYYY-MM-DD key. Call render() after data changes.
   */
  window.createHistoryCalendar = function createHistoryCalendar({ mount, getDays, getSelectedDate, getToday, onSelect }) {
    if (!(mount instanceof HTMLElement) || [getDays, getSelectedDate, getToday, onSelect].some(fn => typeof fn !== 'function')) {
      throw new TypeError('月历需要挂载元素和 getDays、getSelectedDate、getToday、onSelect 函数');
    }

    const initialMonth = monthFromKey(getSelectedDate()) || monthFromKey(getToday());
    let visibleYear = initialMonth.year;
    let visibleMonth = initialMonth.month;
    let lastSelectedDate = getSelectedDate();

    const calendar = makeElement('div', 'history-calendar');
    const header = makeElement('div', 'history-calendar-header');
    const previous = makeElement('button', 'history-calendar-nav', '‹');
    previous.type = 'button';
    previous.setAttribute('aria-label', '上一个月');
    const title = makeElement('strong', 'history-calendar-title');
    title.setAttribute('aria-live', 'polite');
    const next = makeElement('button', 'history-calendar-nav', '›');
    next.type = 'button';
    next.setAttribute('aria-label', '下一个月');
    header.append(previous, title, next);

    const table = makeElement('table', 'history-calendar-table');
    const caption = makeElement('caption', 'sr-only', '按日期查看记录');
    const head = document.createElement('thead');
    const weekdayRow = document.createElement('tr');
    ['一', '二', '三', '四', '五', '六', '日'].forEach(day => {
      const cell = makeElement('th', '', day);
      cell.scope = 'col';
      weekdayRow.append(cell);
    });
    head.append(weekdayRow);
    const body = document.createElement('tbody');
    table.append(caption, head, body);
    calendar.append(header, table);
    mount.replaceChildren(calendar);

    previous.addEventListener('click', () => {
      const month = new Date(visibleYear, visibleMonth - 1, 1);
      visibleYear = month.getFullYear();
      visibleMonth = month.getMonth();
      render();
    });
    next.addEventListener('click', () => {
      const todayMonth = monthFromKey(getToday());
      const month = new Date(visibleYear, visibleMonth + 1, 1);
      if (month.getFullYear() > todayMonth.year || (month.getFullYear() === todayMonth.year && month.getMonth() > todayMonth.month)) return;
      visibleYear = month.getFullYear();
      visibleMonth = month.getMonth();
      render();
    });

    function render() {
      const selected = getSelectedDate();
      const today = getToday();
      const todayMonth = monthFromKey(today);
      if (!todayMonth) return;

      if (selected !== lastSelectedDate) {
        const selectedMonth = monthFromKey(selected);
        if (selectedMonth) {
          visibleYear = selectedMonth.year;
          visibleMonth = selectedMonth.month;
        }
        lastSelectedDate = selected;
      }
      if (visibleYear > todayMonth.year || (visibleYear === todayMonth.year && visibleMonth > todayMonth.month)) {
        visibleYear = todayMonth.year;
        visibleMonth = todayMonth.month;
      }

      title.textContent = `${visibleYear}年${visibleMonth + 1}月`;
      next.disabled = visibleYear === todayMonth.year && visibleMonth === todayMonth.month;
      const rawDays = getDays();
      const recordedDays = new Set(rawDays && typeof rawDays[Symbol.iterator] === 'function' ? rawDays : []);
      const firstWeekday = (new Date(visibleYear, visibleMonth, 1).getDay() + 6) % 7;
      const count = new Date(visibleYear, visibleMonth + 1, 0).getDate();
      const rows = Math.ceil((firstWeekday + count) / 7);
      const fragment = document.createDocumentFragment();

      for (let week = 0; week < rows; week++) {
        const row = document.createElement('tr');
        for (let weekday = 0; weekday < 7; weekday++) {
          const day = week * 7 + weekday - firstWeekday + 1;
          const cell = document.createElement('td');
          if (day >= 1 && day <= count) {
            const key = keyFor(visibleYear, visibleMonth, day);
            const recorded = key <= today && recordedDays.has(key);
            const button = makeElement('button', 'history-calendar-day', String(day));
            button.type = 'button';
            button.disabled = key > today;
            if (recorded) button.classList.add('has-record');
            if (key === selected) {
              button.classList.add('selected');
              button.setAttribute('aria-pressed', 'true');
            }
            if (key === today) button.classList.add('today');
            button.setAttribute('aria-label', `${visibleYear}年${visibleMonth + 1}月${day}日${key === today ? '，今天' : ''}${recorded ? '，有记录' : ''}${key === selected ? '，当前查看' : ''}`);
            if (key === today) button.setAttribute('aria-current', 'date');
            if (!button.disabled) button.addEventListener('click', () => onSelect(key));
            cell.append(button);
          }
          row.append(cell);
        }
        fragment.append(row);
      }
      body.replaceChildren(fragment);
    }

    render();
    return { render };
  };
})();
