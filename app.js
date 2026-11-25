(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const KEY = 'meaning-detective-notebook-v2';
  const MOODS = [
    {value: 'happy', emoji: '😊', label: 'Happy', zh: '开心'},
    {value: 'sad', emoji: '🥲', label: 'Sad', zh: '难过'},
    {value: 'playful', emoji: '😋', label: 'Playful', zh: '俏皮'},
    {value: 'calm', emoji: '😌', label: 'Calm', zh: '平静'},
    {value: 'mixed', emoji: '🎭', label: 'Mixed', zh: '复杂'},
    {value: 'unsure', emoji: '🤔', label: 'Unsure', zh: '不确定'}
  ];
  const CONFIDENCE = [
    {value: 'Low', zh: '低'},
    {value: 'Medium', zh: '中'},
    {value: 'High', zh: '高'}
  ];
  const ROUNDS = [
    {
      title: 'What do you hear?', label: 'SOUND ONLY',
      instruction: 'Listen to the audio from the classroom presentation. Record your first impression.',
      zh: '先听课堂播放的声音，根据第一感觉作答；按 PPT 提示继续。'
    },
    {
      title: 'What do you see?', label: 'SOUND + IMAGE',
      instruction: 'Watch the same clip in the presentation. Notice the visual clues.',
      zh: '音乐相同，加入画面。你的感受有变化吗？按 PPT 提示继续。'
    },
    {
      title: 'What does it mean now?', label: 'SOUND + IMAGE + CAPTION',
      instruction: 'Watch again with the added caption. Notice the story it suggests.',
      zh: '音乐和画面相同，加入情景文案。记录感受后，等 PPT 提示再对比。'
    }
  ];

  const emptyNotebook = () => ({answers: [null, null, null], reflection: ''});
  const validAnswer = answer => answer !== null && typeof answer === 'object' &&
    MOODS.some(mood => mood.value === answer.mood) &&
    CONFIDENCE.some(level => level.value === answer.confidence);
  let notebook = emptyNotebook();
  let storageAvailable = true;
  let storedText = null;

  // This standalone activity reads only v2. Earlier demo records are not migrated.
  try {
    storedText = localStorage.getItem(KEY);
  } catch {
    storageAvailable = false;
  }
  if (storedText) {
    try {
      const stored = JSON.parse(storedText);
      if (stored && Array.isArray(stored.answers)) {
        notebook.answers = [0, 1, 2].map(index => {
          const answer = stored.answers[index];
          return validAnswer(answer)
            ? {mood: answer.mood, confidence: answer.confidence}
            : null;
        });
        if (typeof stored.reflection === 'string') {
          notebook.reflection = stored.reflection.slice(0, 500);
        }
      }
    } catch {
      // Invalid saved data is ignored; a parsing error is not a storage outage.
      notebook = emptyNotebook();
    }
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function storageMessage() {
    $('storage-note').textContent = storageAvailable
      ? 'Your notebook stays in this browser. No names, shared live results or class leaderboard.'
      : 'Browser storage is unavailable. Changes stay in this tab only; keep it open and copy your findings before leaving.';
  }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(notebook));
      storageAvailable = true;
    } catch {
      storageAvailable = false;
    }
    storageMessage();
    updateWelcome();
  }

  function updateWelcome() {
    const savedCount = notebook.answers.filter(Boolean).length;
    $('start-activity').textContent = savedCount === 3
      ? 'Review my findings'
      : savedCount > 0 ? 'Continue my notebook' : 'Start the activity';
    $('start-hint').textContent = savedCount === 3
      ? 'Your three saved impressions are ready to review. You can start a new notebook from the activity page.'
      : savedCount > 0
        ? `${savedCount} of 3 impressions saved. Continue at the first unanswered round and follow the PPT cues.`
        : 'Use your phone to record your impressions. Follow the PPT cues before continuing; there are no shared live votes.';
  }

  function scrollToTop() {
    window.scrollTo({top: 0, behavior: 'auto'});
  }

  function showPanel(name) {
    for (const id of ['student-round', 'student-results', 'student-context']) {
      $(id).hidden = id !== name;
    }
  }

  function progress(stage) {
    $('student-progress').replaceChildren();
    for (let index = 0; index < 5; index++) {
      const marker = element('span', index <= stage ? 'active' : '');
      marker.setAttribute('aria-hidden', 'true');
      $('student-progress').append(marker);
    }
    $('student-progress').setAttribute('aria-label', `Step ${stage + 1} of 5`);
  }

  let round = 0;
  let selectedMood = null;
  let selectedConfidence = null;
  const moodInputs = [];
  const confidenceInputs = [];

  function updateSave() {
    $('save-answer').disabled = !(selectedMood && selectedConfidence);
    $('answer-saved').hidden = true;
    $('student-next').disabled = true;
  }

  for (const mood of MOODS) {
    const option = element('div', 'mood-option');
    const input = element('input');
    input.type = 'radio';
    input.name = 'mood';
    input.id = `mood-${mood.value}`;
    input.value = mood.value;
    const label = element('label');
    label.htmlFor = input.id;
    const emoji = element('span', 'emoji', mood.emoji);
    emoji.setAttribute('aria-hidden', 'true');
    const chinese = element('small', '', mood.zh);
    chinese.lang = 'zh-CN';
    label.append(emoji, document.createTextNode(mood.label), chinese);
    option.append(input, label);
    $('mood-options').append(option);
    moodInputs.push(input);
    input.addEventListener('change', () => {
      selectedMood = mood.value;
      updateSave();
    });
  }

  for (const level of CONFIDENCE) {
    const option = element('div', 'confidence-option');
    const input = element('input');
    input.type = 'radio';
    input.name = 'confidence';
    input.id = `confidence-${level.value.toLowerCase()}`;
    input.value = level.value;
    const label = element('label', '', `${level.value} / ${level.zh}`);
    label.htmlFor = input.id;
    option.append(input, label);
    $('confidence-options').append(option);
    confidenceInputs.push(input);
    input.addEventListener('change', () => {
      selectedConfidence = level.value;
      updateSave();
    });
  }

  function showRound(index) {
    round = index;
    showPanel('student-round');
    progress(index);
    const saved = notebook.answers[index];
    selectedMood = saved?.mood || null;
    selectedConfidence = saved?.confidence || null;
    $('student-round-label').textContent = `ROUND ${index + 1} · ${ROUNDS[index].label}`;
    $('student-title').textContent = ROUNDS[index].title;
    $('student-instruction').textContent = ROUNDS[index].instruction;
    $('student-instruction-zh').textContent = ROUNDS[index].zh;
    moodInputs.forEach(input => { input.checked = input.value === selectedMood; });
    confidenceInputs.forEach(input => { input.checked = input.value === selectedConfidence; });
    $('save-answer').textContent = saved ? 'Update my impression' : 'Save my impression';
    $('save-answer').disabled = !(selectedMood && selectedConfidence);
    $('answer-saved').hidden = !saved;
    $('student-next').disabled = !saved;
    $('student-next').textContent = index === 2
      ? 'Compare when prompted'
      : 'Continue when prompted';
  }

  function showResults() {
    const incomplete = notebook.answers.findIndex(answer => !answer);
    if (incomplete !== -1) {
      showRound(incomplete);
      return;
    }
    showPanel('student-results');
    progress(3);
    const changed = new Set(notebook.answers.map(answer => answer.mood)).size > 1;
    $('result-summary').textContent = changed
      ? 'Your emotion choices shifted. Which new clue influenced you?'
      : 'Your emotion choice stayed the same. Did your reason or confidence change?';
    $('result-cards').replaceChildren();
    notebook.answers.forEach((answer, index) => {
      const mood = MOODS.find(item => item.value === answer.mood);
      const card = element('div', 'result-card');
      const emoji = element('span', 'emoji', mood.emoji);
      emoji.setAttribute('aria-hidden', 'true');
      card.append(
        element('span', 'eyebrow', ['SOUND', '+ IMAGE', '+ CAPTION'][index]),
        emoji,
        element('strong', '', mood.label),
        element('p', '', `${answer.confidence} confidence`)
      );
      $('result-cards').append(card);
    });
    $('reflection').value = notebook.reflection;
    $('copy-status').textContent = '';
  }

  function showWelcome() {
    $('welcome').hidden = false;
    $('student').hidden = true;
    $('back-home').hidden = true;
    updateWelcome();
  }

  $('start-activity').addEventListener('click', () => {
    $('welcome').hidden = true;
    $('student').hidden = false;
    $('back-home').hidden = false;
    const savedCount = notebook.answers.filter(Boolean).length;
    $('resume-note').hidden = savedCount === 0;
    $('resume-note').textContent = 'Your saved notebook is restored. Follow the current PPT cue, or choose “Start a new notebook” below for a new activity.';
    const incomplete = notebook.answers.findIndex(answer => !answer);
    if (incomplete === -1) showResults(); else showRound(incomplete);
    scrollToTop();
  });

  $('back-home').addEventListener('click', () => {
    showWelcome();
    scrollToTop();
    $('start-activity').focus();
  });

  $('save-answer').addEventListener('click', () => {
    if (!selectedMood || !selectedConfidence) return;
    notebook.answers[round] = {mood: selectedMood, confidence: selectedConfidence};
    persist();
    $('answer-saved').hidden = false;
    $('student-next').disabled = false;
    $('save-answer').textContent = 'Update my impression';
  });

  $('student-next').addEventListener('click', () => {
    const saved = notebook.answers[round];
    if (!saved || saved.mood !== selectedMood || saved.confidence !== selectedConfidence) return;
    if (round < 2) showRound(round + 1); else showResults();
    scrollToTop();
  });

  $('reflection').addEventListener('input', () => {
    notebook.reflection = $('reflection').value.slice(0, 500);
    persist();
    $('copy-status').textContent = '';
  });

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const previousFocus = document.activeElement;
      const textarea = element('textarea');
      textarea.value = text;
      textarea.readOnly = true;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      document.body.append(textarea);
      let copied = false;
      try {
        textarea.select();
        textarea.setSelectionRange(0, text.length);
        copied = document.execCommand('copy');
      } catch {
        copied = false;
      } finally {
        textarea.remove();
        if (previousFocus && typeof previousFocus.focus === 'function') {
          previousFocus.focus({preventScroll: true});
        }
      }
      return copied;
    }
  }

  $('copy-findings').addEventListener('click', async () => {
    if (notebook.answers.some(answer => !answer)) return;
    const lines = notebook.answers.map((answer, index) => {
      const mood = MOODS.find(item => item.value === answer.mood);
      return `Round ${index + 1}: ${mood.label}, ${answer.confidence.toLowerCase()} confidence`;
    });
    const text = `Meaning Detective\n${lines.join('\n')}\nReflection: ${notebook.reflection}`;
    const copied = await copyText(text);
    $('copy-status').textContent = copied
      ? 'Copied. You can paste your findings into your own notes.'
      : 'Copy is unavailable. Copy your three choices and reflection manually from this page.';
  });

  $('to-context').addEventListener('click', () => {
    showPanel('student-context');
    progress(4);
    scrollToTop();
  });

  $('back-to-results').addEventListener('click', () => {
    showResults();
    scrollToTop();
  });

  $('reset-student').addEventListener('click', () => {
    if (!window.confirm('Clear the three impressions and reflection in this notebook? This only affects this browser.\n清空这份记录并重新开始？仅影响当前浏览器。')) return;
    notebook = emptyNotebook();
    persist();
    $('resume-note').hidden = true;
    $('reflection').value = '';
    $('copy-status').textContent = '';
    showRound(0);
    scrollToTop();
  });

  // Every URL opens the welcome page, including older query-string links.
  storageMessage();
  showWelcome();
})();
