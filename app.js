(() => {
  'use strict';
  const STORAGE_KEY = 'daily-notes-v1';
  const $ = (id) => document.getElementById(id);
  const formatter = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  const weekdayFormatter = new Intl.DateTimeFormat('zh-CN', { weekday: 'long' });
  const todayKey = () => dateKey(new Date());
  const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const fromKey = (key) => { const [y,m,d] = key.split('-').map(Number); return new Date(y,m-1,d); };
  const emptyLearning = () => ({ topic: '', minutes: '', takeaway: '', learningNext: '' });
  const emptyReflection = () => ({ good: '', hard: '', reflectionNext: '' });
  const emptyDay = () => ({ tasks: [], learning: [emptyLearning()], reflections: [emptyReflection()] });
  const hasLearningContent = (entry) => Object.keys(emptyLearning()).some(key => String(entry?.[key] ?? '').trim());
  const hasReflectionContent = (entry) => Object.keys(emptyReflection()).some(key => String(entry?.[key] ?? '').trim());
  function getLearning(day) {
    if (Array.isArray(day.learning) && day.learning.length) return day.learning.slice(0, 3);
    const legacy = { topic: day.topic ?? '', minutes: day.minutes ?? '', takeaway: day.takeaway ?? '', learningNext: day.learningNext ?? '' };
    return [hasLearningContent(legacy) ? legacy : emptyLearning()];
  }
  function ensureLearning(day) {
    if (!Array.isArray(day.learning) || !day.learning.length) day.learning = getLearning(day);
    return day.learning;
  }
  function getReflections(day) {
    if (Array.isArray(day.reflections) && day.reflections.length) return day.reflections.slice(0, 3);
    const legacy = { good: day.good ?? '', hard: day.hard ?? '', reflectionNext: day.reflectionNext ?? '' };
    return [hasReflectionContent(legacy) ? legacy : emptyReflection()];
  }
  function ensureReflections(day) {
    if (!Array.isArray(day.reflections) || !day.reflections.length) day.reflections = getReflections(day);
    return day.reflections;
  }
  let data = { version: 1, days: {} };
  let selectedDate = todayKey();
  let toastTimer;
  let historyCalendar;

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.version === 1 && saved.days && typeof saved.days === 'object' && !Array.isArray(saved.days)) data = saved;
  } catch (_) { showToast('无法读取本机记录，请检查浏览器存储设置。'); }

  function currentDay() { return data.days[selectedDate] || emptyDay(); }
  function ensureDay() { return (data.days[selectedDate] ||= emptyDay()); }
  function hasContent(day) { return !!(day.tasks?.length || getLearning(day).some(hasLearningContent) || getReflections(day).some(hasReflectionContent)); }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); $('save-status').textContent = '已保存到此设备'; }
    catch (_) { $('save-status').textContent = '保存失败，请导出备份'; showToast('保存失败。可能是浏览器存储空间不足。'); }
  }
  function showToast(message) {
    const el = $('toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
  }
  function render() {
    const date = fromKey(selectedDate);
    const isToday = selectedDate === todayKey();
    $('date-title').textContent = formatter.format(date);
    $('date-weekday').textContent = weekdayFormatter.format(date);
    $('date-picker').value = selectedDate;
    $('date-picker').max = todayKey();
    $('status-date-picker').value = selectedDate;
    $('status-date-picker').max = todayKey();
    $('day-status').textContent = isToday ? '今天' : '历史日期';
    $('today-button').hidden = isToday;
    $('next-day').disabled = selectedDate >= todayKey();
    $('page-title').textContent = isToday ? '今天，慢慢来。' : '回望这一天。';
    $('tasks-heading').textContent = isToday ? '今日任务' : '当日任务';
    $('overview-heading').textContent = isToday ? '今日一览' : '当日一览';
    $('task-empty').textContent = isToday ? '从一件小事开始，今天就有了方向。' : '这一天还没有任务。';
    renderTasks(); renderLearning(); renderReflections(); renderHistory();
  }
  function renderLearning(expandedIndex = 0) {
    const learning = getLearning(currentDay());
    const list = $('learning-list'); list.replaceChildren();
    learning.forEach((entry, index) => {
      const section = document.createElement('section'); section.className = 'learning-entry';
      section.innerHTML = '<div class="learning-entry-heading"><button type="button" class="entry-toggle"><span class="entry-label"></span><span class="entry-summary"></span><span class="entry-chevron" aria-hidden="true">⌄</span></button><button type="button" class="remove-learning">删除这项</button></div><div class="form-grid"><label class="field wide"><span>今天学了什么</span><input data-learning-field="topic" maxlength="150" placeholder="例如：读了《刻意练习》第三章" /></label><label class="field minutes-field"><span>学习时长 <small>可选</small></span><div class="input-suffix"><input data-learning-field="minutes" type="number" min="0" max="1440" inputmode="numeric" placeholder="0" /><span>分钟</span></div></label><label class="field full"><span>最重要的收获</span><textarea data-learning-field="takeaway" rows="3" placeholder="用自己的话记下一点理解…"></textarea></label><label class="field full"><span>下一步想学什么</span><input data-learning-field="learningNext" maxlength="200" placeholder="留给明天的一个小方向" /></label></div>';
      const heading = section.querySelector('.learning-entry-heading');
      section.querySelector('.form-grid .field.wide > span').textContent = selectedDate === todayKey() ? '今天学了什么' : '那天学了什么';
      const toggle = heading.querySelector('.entry-toggle');
      const form = section.querySelector('.form-grid');
      const summary = heading.querySelector('.entry-summary');
      const updateSummary = () => { summary.textContent = (entry.topic || entry.takeaway || '未填写内容').trim().slice(0, 28) || '未填写内容'; };
      heading.querySelector('.entry-label').textContent = `学习 ${index + 1}`;
      updateSummary();
      heading.hidden = learning.length === 1;
      form.hidden = learning.length > 1 && index !== expandedIndex;
      toggle.setAttribute('aria-expanded', String(!form.hidden));
      toggle.addEventListener('click', () => { form.hidden = !form.hidden; toggle.setAttribute('aria-expanded', String(!form.hidden)); });
      section.querySelector('.remove-learning').addEventListener('click', () => {
        if (hasLearningContent(entry) && !confirm('删除这条学习记录？')) return;
        ensureLearning(ensureDay()).splice(index, 1);
        save(); renderLearning(); renderHistory();
      });
      section.querySelectorAll('[data-learning-field]').forEach(input => {
        const key = input.dataset.learningField; input.value = entry[key] ?? '';
        input.addEventListener('input', () => {
          const target = ensureLearning(ensureDay())[index];
          target[key] = key === 'minutes' ? input.value.replace(/[^0-9]/g, '').slice(0, 4) : input.value;
          entry[key] = target[key];
          if (input.value !== target[key]) input.value = target[key];
          updateSummary();
          save(); renderHistory();
        });
      });
      list.append(section);
    });
    $('learning-count').textContent = `${learning.length} / 3`;
    $('add-learning').firstChild.textContent = learning.length >= 3 ? '最多记录 3 项 ' : '＋ 添加一项学习记录 ';
    $('add-learning').disabled = learning.length >= 3;
  }
  function renderReflections(expandedIndex = 0) {
    const reflections = getReflections(currentDay());
    const list = $('reflection-list'); list.replaceChildren();
    reflections.forEach((entry, index) => {
      const section = document.createElement('section'); section.className = 'reflection-entry';
      section.innerHTML = '<div class="reflection-entry-heading"><button type="button" class="entry-toggle"><span class="entry-label"></span><span class="entry-summary"></span><span class="entry-chevron" aria-hidden="true">⌄</span></button><button type="button" class="remove-learning">删除这项</button></div><div class="reflection-fields"><label class="field full"><span>今天做得好的一件事</span><textarea data-reflection-field="good" rows="2" placeholder="哪怕是一件很小的事…"></textarea></label><label class="field full"><span>遇到了什么困难</span><textarea data-reflection-field="hard" rows="2" placeholder="有什么地方让你停了下来？"></textarea></label><label class="field full"><span>明天想怎么调整</span><textarea data-reflection-field="reflectionNext" rows="2" placeholder="给明天的自己一个具体建议"></textarea></label></div>';
      const heading = section.querySelector('.reflection-entry-heading');
      section.querySelector('.reflection-fields .field:first-child > span').textContent = selectedDate === todayKey() ? '今天做得好的一件事' : '那天做得好的一件事';
      const toggle = heading.querySelector('.entry-toggle');
      const form = section.querySelector('.reflection-fields');
      const summary = heading.querySelector('.entry-summary');
      const updateSummary = () => { summary.textContent = (entry.good || entry.hard || entry.reflectionNext || '未填写内容').trim().slice(0, 28) || '未填写内容'; };
      heading.querySelector('.entry-label').textContent = `反思 ${index + 1}`;
      updateSummary();
      heading.hidden = reflections.length === 1;
      form.hidden = reflections.length > 1 && index !== expandedIndex;
      toggle.setAttribute('aria-expanded', String(!form.hidden));
      toggle.addEventListener('click', () => { form.hidden = !form.hidden; toggle.setAttribute('aria-expanded', String(!form.hidden)); });
      section.querySelector('.remove-learning').addEventListener('click', () => {
        if (hasReflectionContent(entry) && !confirm('删除这条反思记录？')) return;
        ensureReflections(ensureDay()).splice(index, 1);
        save(); renderReflections(); renderHistory();
      });
      section.querySelectorAll('[data-reflection-field]').forEach(input => {
        const key = input.dataset.reflectionField; input.value = entry[key] ?? '';
        input.addEventListener('input', () => {
          ensureReflections(ensureDay())[index][key] = input.value;
          entry[key] = input.value;
          updateSummary();
          save(); renderHistory();
        });
      });
      list.append(section);
    });
    $('reflection-count').textContent = `${reflections.length} / 3`;
    $('add-reflection').firstChild.textContent = reflections.length >= 3 ? '最多记录 3 项 ' : '＋ 添加一项反思 ';
    $('add-reflection').disabled = reflections.length >= 3;
  }
  function renderTasks() {
    const day = currentDay(); const tasks = Array.isArray(day.tasks) ? day.tasks : [];
    const list = $('task-list'); list.replaceChildren();
    tasks.forEach((task) => {
      const item = document.createElement('li'); item.className = `task-item${task.done ? ' done' : ''}`;
      const row = document.createElement('div'); row.className = 'task-row';
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.className = 'task-check'; checkbox.checked = !!task.done; checkbox.setAttribute('aria-label', `完成任务：${task.text}`);
      checkbox.addEventListener('change', () => { task.done = checkbox.checked; save(); renderTasks(); renderHistory(); });
      const label = document.createElement('span'); label.className = 'task-text'; label.textContent = task.text;
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'delete-task'; remove.textContent = '×'; remove.setAttribute('aria-label', `删除任务：${task.text}`);
      remove.addEventListener('click', () => { day.tasks = day.tasks.filter(t => t.id !== task.id); save(); renderTasks(); renderHistory(); });
      row.append(checkbox, label, remove); item.append(row);
      if (!task.done) {
        const note = document.createElement('input'); note.type = 'text'; note.className = 'task-note'; note.maxLength = 300;
        note.placeholder = '备注：为什么没完成？（可选）'; note.value = task.note || '';
        note.setAttribute('aria-label', `未完成原因：${task.text}`);
        note.addEventListener('input', () => { task.note = note.value; save(); });
        item.append(note);
      }
      list.append(item);
    });
    const completed = tasks.filter(t => t.done).length;
    $('task-empty').hidden = tasks.length > 0;
    $('task-progress').textContent = `${completed} / ${tasks.length} 完成`;
    $('overview-count').textContent = String(completed);
    $('progress-bar').style.width = `${tasks.length ? Math.round(completed / tasks.length * 100) : 0}%`;
    $('overview-note').textContent = tasks.length && completed === tasks.length ? (selectedDate === todayKey() ? '今天的任务都完成了，做得好。' : '这一天的任务都完成了。') : '一点点向前，就很好。';
  }
  function renderHistory() {
    historyCalendar.render();
  }
  function selectDate(key) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || dateKey(fromKey(key)) !== key) return;
    if (key > todayKey()) { $('date-picker').value = selectedDate; $('status-date-picker').value = selectedDate; showToast('只能查看今天及以前的日期'); return; }
    selectedDate = key; render(); window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  $('prev-day').addEventListener('click', () => { const d = fromKey(selectedDate); d.setDate(d.getDate() - 1); selectDate(dateKey(d)); });
  $('next-day').addEventListener('click', () => { const d = fromKey(selectedDate); d.setDate(d.getDate() + 1); selectDate(dateKey(d)); });
  $('today-button').addEventListener('click', () => selectDate(todayKey()));
  $('history-today').addEventListener('click', () => selectDate(todayKey()));
  $('date-picker').addEventListener('change', (e) => selectDate(e.target.value));
  $('status-date-picker').addEventListener('change', (e) => selectDate(e.target.value));
  for (const id of ['date-picker', 'status-date-picker']) {
    $(id).addEventListener('click', (e) => {
      try { e.currentTarget.showPicker?.(); } catch (_) { /* Safari may open its native picker directly. */ }
    });
  }
  $('task-form').addEventListener('submit', (e) => {
    e.preventDefault(); const input = $('task-input'); const value = input.value.trim(); if (!value) return;
    ensureDay().tasks.push({ id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, text: value, done: false, note: '' });
    input.value = ''; save(); renderTasks(); renderHistory(); input.focus();
  });
  $('add-learning').addEventListener('click', () => {
    const learning = ensureLearning(ensureDay()); if (learning.length >= 3) return;
    learning.push(emptyLearning()); save(); renderLearning(learning.length - 1);
    $('learning-list').lastElementChild.querySelector('[data-learning-field="topic"]').focus();
  });
  $('add-reflection').addEventListener('click', () => {
    const reflections = ensureReflections(ensureDay()); if (reflections.length >= 3) return;
    reflections.push(emptyReflection()); save(); renderReflections(reflections.length - 1);
    $('reflection-list').lastElementChild.querySelector('[data-reflection-field="good"]').focus();
  });
  const dialog = $('backup-dialog'); $('backup-open').addEventListener('click', () => dialog.showModal());
  $('import-button').addEventListener('click', () => $('import-file').click());
  $('export-button').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ ...data, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `每日手记-备份-${todayKey()}.json`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); showToast('备份文件已导出');
  });
  $('import-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('文件超过 10 MB');
      const imported = JSON.parse(await file.text());
      if (imported.version !== 1 || !imported.days || typeof imported.days !== 'object' || Array.isArray(imported.days)) throw new Error('文件格式不正确');
      const normalized = { version: 1, days: {} };
      for (const [key, raw] of Object.entries(imported.days)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('记录内容不正确');
        const day = emptyDay();
        day.tasks = Array.isArray(raw.tasks) ? raw.tasks.filter(t => t && typeof t.text === 'string').map(t => ({ id: String(t.id || `${Date.now()}-${Math.random()}`), text: t.text.slice(0,120), done: !!t.done, note: typeof t.note === 'string' ? t.note.slice(0,300) : '' })) : [];
        day.learning = getLearning(raw).map(entry => ({
          topic: typeof entry.topic === 'string' ? entry.topic.slice(0, 150) : '',
          minutes: typeof entry.minutes === 'string' ? entry.minutes.replace(/[^0-9]/g, '').slice(0, 4) : '',
          takeaway: typeof entry.takeaway === 'string' ? entry.takeaway.slice(0, 10000) : '',
          learningNext: typeof entry.learningNext === 'string' ? entry.learningNext.slice(0, 200) : ''
        }));
        day.reflections = getReflections(raw).map(entry => ({
          good: typeof entry.good === 'string' ? entry.good.slice(0, 10000) : '',
          hard: typeof entry.hard === 'string' ? entry.hard.slice(0, 10000) : '',
          reflectionNext: typeof entry.reflectionNext === 'string' ? entry.reflectionNext.slice(0, 10000) : ''
        }));
        normalized.days[key] = day;
      }
      if (!confirm('导入会覆盖当前浏览器中的全部记录。确定继续吗？')) return;
      const previous = data; data = normalized;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (error) { data = previous; throw error; }
      dialog.close(); render(); showToast('备份已导入');
    } catch (error) { showToast(`导入失败：${error.message}`); }
    finally { e.target.value = ''; }
  });
  historyCalendar = window.createHistoryCalendar({
    mount: $('history-list'),
    getDays: () => Object.keys(data.days).filter(key => hasContent(data.days[key])),
    getSelectedDate: () => selectedDate,
    getToday: todayKey,
    onSelect: selectDate
  });
  render();
})();
