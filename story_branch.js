/* =====================================================================
   story_branch.js - route tracking and ending resolution.

   Three counters run the whole game:
     - what you killed          (FIGHT, by faction)
     - what you spared          (ACT/SPARE, by faction)
     - which stage objective you completed (DARK / HERO / NORMAL)

   Those feed three scores, and the score that wins at the Black Comet
   decides which of the four endings the game plays:

     ending_dark      인류 학살 루트   - FIGHT 위주 / 인간 적대
     ending_bystander 방관자 루트      - 아무도 죽이지 않음
     ending_hero      외계인 학살 루트 - 블랙 암즈만 처치, 인간은 SPARE
     ending_true      Last Story       - ending_hero 클리어 + 에메랄드 7개
   ===================================================================== */
(function (SH) {
  'use strict';

  var Story = SH.Story = {

    /* ---------------- state ------------------------------------------ */
    kill:  { human: 0, alien: 0, sonic: 0 },
    spare: { human: 0, alien: 0, sonic: 0 },
    fled: 0,
    battles: 0,
    stageResult: {},        // stageId -> 'dark' | 'hero' | 'normal'
    flags: {
      ending3Cleared: false,
      lastStoryUnlocked: false,
      lastStoryCleared: false,
      metSonic: false,
      doomDefeated: false
    },
    clearedEndings: {},     // endingKey -> true (persists across runs)

    reset: function () {
      this.kill = { human: 0, alien: 0, sonic: 0 };
      this.spare = { human: 0, alien: 0, sonic: 0 };
      this.fled = 0;
      this.battles = 0;
      this.stageResult = {};
      this.flags.metSonic = false;
      this.flags.doomDefeated = false;
    },

    /* ---------------- recording -------------------------------------- */
    recordKill: function (faction) {
      if (this.kill[faction] === undefined) faction = 'human';
      this.kill[faction]++;
    },
    recordSpare: function (faction) {
      if (this.spare[faction] === undefined) faction = 'human';
      this.spare[faction]++;
    },
    recordFlee: function () { this.fled++; },
    recordBattle: function () { this.battles++; },
    recordStage: function (stageId, objective) {
      this.stageResult[stageId] = objective;
    },

    /* ---------------- derived numbers -------------------------------- */
    totalKills: function () {
      return this.kill.human + this.kill.alien + this.kill.sonic;
    },
    totalSpares: function () {
      return this.spare.human + this.spare.alien + this.spare.sonic;
    },
    stagesOf: function (kind) {
      var n = 0, r = this.stageResult;
      for (var k in r) if (r[k] === kind) n++;
      return n;
    },

    /* A kill on Sonic's crew weighs heavily - it is the point of no
       return for the dark route, exactly as in the 2005 game. */
    darkScore: function () {
      return this.kill.human * 2 + this.kill.sonic * 6 + this.stagesOf('dark') * 12;
    },
    heroScore: function () {
      return this.kill.alien * 2 + this.spare.human * 1 + this.stagesOf('hero') * 12;
    },
    neutralScore: function () {
      return this.totalSpares() * 2 + this.stagesOf('normal') * 14;
    },

    /* "Pure" runs are what the design doc asks the endings to key on. */
    isPurePacifist: function () { return this.totalKills() === 0; },
    isPureHero: function () {
      return this.kill.alien > 0 && this.kill.human === 0 && this.kill.sonic === 0;
    },
    isPureDark: function () {
      return this.kill.alien === 0 && (this.kill.human + this.kill.sonic) > 0;
    },

    dominantRoute: function () {
      if (this.isPurePacifist()) return 'normal';
      var d = this.darkScore(), h = this.heroScore(), n = this.neutralScore();
      if (d >= h && d >= n) return 'dark';
      if (h >= n) return 'hero';
      return 'normal';
    },

    /* Which boss the Black Comet finale puts in front of the player. */
    finalBossFor: function (route) {
      if (route === 'dark') return 'sonic';
      if (route === 'hero') return 'black_doom';
      return null;                     // the bystander route has no fight
    },

    /* ---------------- ending resolution -------------------------------- */
    evaluateEnding: function () {
      if (this.isPurePacifist()) return 'ending_bystander';
      var route = this.dominantRoute();
      if (route === 'dark') return 'ending_dark';
      if (route === 'hero') return 'ending_hero';
      return 'ending_bystander';
    },

    /* Last Story opens on a clean hero run with all seven emeralds. */
    canUnlockLastStory: function (emeraldCount) {
      return this.flags.ending3Cleared && this.isPureHero() && emeraldCount >= 7;
    },

    markEndingCleared: function (key, emeraldCount) {
      this.clearedEndings[key] = true;
      if (key === 'ending_hero') {
        this.flags.ending3Cleared = true;
        if (this.canUnlockLastStory(emeraldCount || 0)) {
          this.flags.lastStoryUnlocked = true;
        }
      }
      if (key === 'ending_true') this.flags.lastStoryCleared = true;
    },

    /* Human-readable route summary for the pause menu. */
    summary: function () {
      return [
        '처치  인간 ' + this.kill.human + ' / 외계 ' + this.kill.alien +
          ' / 소닉 진영 ' + this.kill.sonic,
        '자비  인간 ' + this.spare.human + ' / 외계 ' + this.spare.alien +
          ' / 소닉 진영 ' + this.spare.sonic,
        '미션  다크 ' + this.stagesOf('dark') + ' · 히어로 ' + this.stagesOf('hero') +
          ' · 노멀 ' + this.stagesOf('normal'),
        '경향  ' + ({ dark: '어둠 (인류 적대)', hero: '영웅 (블랙 암즈 적대)',
                      normal: '중립 / 방관' })[this.dominantRoute()]
      ];
    },

    /* ---------------- ending scripts ------------------------------------ */
    script: function (key) {
      var S = { who: '섀도우', face: 'face_shadow' };
      var D = { who: '블랙 둠', face: 'face_doom', color: '#c0ff3c' };
      var M = { who: '마리아', face: 'face_maria', color: '#7fd7ff' };
      var N = function (t) { return { text: t }; };

      switch (key) {

        case 'ending_dark': return [
          N('소닉이 쓰러졌다. 저항할 수 있는 마지막 속도가 멈췄다.'),
          { who: D.who, face: D.face, color: D.color,
            text: '훌륭하다. 이제 이 별은 우리의 목장이다.' },
          { who: S.who, face: S.face, frame: 1,
            text: '...너희의 것도 아니다. 이 별은 이제 내 것이다.' },
          N('섀도우는 블랙 둠의 옆이 아니라, 그 앞에 섰다.\n' +
            '검은 혜성의 그림자가 도시를 삼키는 동안 그는 눈을 감지 않았다.'),
          N('인류는 그날 이후 기록되지 않았다.\n' +
            '우주에 남은 것은 단 하나의 이름뿐이었다.'),
          N('― 나는 섀도우. 궁극의 생명체다. ―'),
          N('ENDING 1 : 인류 학살 루트\n"DEVIL\'S CROWN"')
        ];

        case 'ending_bystander': return [
          N('섀도우는 아무것도 하지 않았다.'),
          { who: S.who, face: S.face,
            text: '...나와는 상관없는 싸움이다.' },
          N('G.U.N.의 방어선은 사흘을 버텼다.\n' +
            '블랙 암즈는 나흘째에 도시를 덮었다.'),
          { who: D.who, face: D.face, color: D.color,
            text: '고맙다, 섀도우. 네 침묵이 우리를 이기게 했다.' },
          N('섀도우는 폐허 위에 서서 하늘을 본다.\n' +
            '누구의 편도 들지 않은 자에게는, 어느 쪽의 미래도 남지 않았다.'),
          { who: M.who, face: M.face, color: M.color,
            text: '(기억) 섀도우... 모두를... 행복하게...' },
          N('그 목소리에 대답할 말을, 그는 끝내 찾지 못했다.'),
          N('ENDING 2 : 방관자 루트\n"THE ONE WHO WATCHED"')
        ];

        case 'ending_hero': return [
          N('블랙 둠이 무너졌다. 검은 혜성이 궤도에서 흔들린다.'),
          { who: D.who, face: D.face, color: D.color,
            text: '어리석은... 너는 나의 피다... 그 사실은 변하지 않아...' },
          { who: S.who, face: S.face, frame: 1,
            text: '피가 무엇이든, 선택은 내가 한다.' },
          N('G.U.N.은 그를 영웅이라 불렀다.\n' +
            '사람들은 이름을 몰라도 그 실루엣에 손을 흔들었다.'),
          { who: S.who, face: S.face,
            text: '...그런데 왜, 아직도 개운하지 않지.' },
          N('혜성은 아직 하늘에 있다.\n' +
            '그리고 그의 기원에 대한 물음은 하나도 답해지지 않았다.'),
          N('ENDING 3 : 외계인 학살 루트\n"HERO WITHOUT AN ORIGIN"'),
          N('… [LAST STORY] 로 가는 길이 열렸다. …')
        ];

        case 'ending_true': return [
          N('일곱 개의 카오스 에메랄드가 그를 중심으로 궤도를 그린다.'),
          { who: S.who, face: 'face_super',
            text: '카오스... 컨트롤!' },
          N('데빌 둠의 세 번째 눈이 마침내 감겼다.\n' +
            '검은 혜성이 스스로의 무게로 무너져 내린다.'),
          { who: M.who, face: M.face, color: M.color,
            text: '섀도우. 모두를 행복하게 해줘. ...부탁이야.' },
          { who: S.who, face: 'face_super',
            text: '알고 있어, 마리아. 이번엔 잊지 않는다.' },
          N('그는 자신의 기원을 적은 데이터 디스크를 손 안에서 부순다.\n' +
            '무엇으로 만들어졌는지는, 더 이상 그를 정의하지 못한다.'),
          { who: S.who, face: S.face,
            text: '안녕이다, 섀도우 더 헤지혹.' },
          N('그리고 그는 뒤돌아, 다시 걷기 시작했다.'),
          N('TRUE ENDING : LAST STORY\n"GOODBYE, SHADOW THE HEDGEHOG"')
        ];
      }
      return [N('...')];
    },

    endingTitle: function (key) {
      return ({
        ending_dark: 'ENDING 1 · 인류 학살 루트',
        ending_bystander: 'ENDING 2 · 방관자 루트',
        ending_hero: 'ENDING 3 · 외계인 학살 루트',
        ending_true: 'TRUE ENDING · LAST STORY'
      })[key] || 'ENDING';
    },

    endingBgm: function (key) {
      return ({
        ending_dark: 'ending_dark',
        ending_bystander: 'ending_dark',
        ending_hero: 'ending_hero',
        ending_true: 'ending_true'
      })[key] || 'ending_hero';
    },

    /* ---------------- persistence ---------------------------------------- */
    save: function () {
      return {
        kill: this.kill, spare: this.spare, fled: this.fled,
        battles: this.battles, stageResult: this.stageResult,
        flags: this.flags, clearedEndings: this.clearedEndings
      };
    },
    load: function (d) {
      if (!d) return;
      this.kill = d.kill || this.kill;
      this.spare = d.spare || this.spare;
      this.fled = d.fled || 0;
      this.battles = d.battles || 0;
      this.stageResult = d.stageResult || {};
      for (var k in (d.flags || {})) this.flags[k] = d.flags[k];
      this.clearedEndings = d.clearedEndings || {};
    }
  };
})(window.SH = window.SH || {});
