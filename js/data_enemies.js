/* =====================================================================
   data_enemies.js - battle actors, ACT trees, mercy rules, patterns.

   faction decides which ending counter a kill or a spare feeds:
     'human'  G.U.N. and its machines      -> DARK route material
     'alien'  Black Arms                   -> HERO route material
     'sonic'  Sonic's crew (counts as human side, weighted heavier)
   ===================================================================== */
(function (SH) {
  'use strict';

  SH.Enemies = {

    /* ---------------- G.U.N. ---------------------------------------- */
    gun_soldier: {
      id: 'gun_soldier', name: 'G.U.N. 병사', sheet: 'gun_soldier',
      faction: 'human', hp: 34, atk: 6, def: 1, exp: 9, rings: 12,
      check: 'G.U.N. 병사 - AT 6 / DF 1\n50년 전의 명령서를 아직도 들고 있다.',
      flavor: [
        'G.U.N. 병사가 무전기에 대고 소리친다.',
        '손이 떨리고 있다. 방아쇠에 걸린 채로.',
        '헬멧 바이저 너머로 너를 확인하려 한다.',
        '"프로젝트 섀도우"라는 단어가 새어나온다.'
      ],
      says: ['"명령이다... 명령이야!"', '"저건... 그 실험체?"', '"물러서지 마!"'],
      acts: [
        { name: '관찰', mercy: 0, text: ['G.U.N. 병사 - AT 6 / DF 1', '두려움이 총구보다 앞서 있다.'] },
        { name: '설득', mercy: 1, text: ['"너희가 쫓는 건 내가 아니다."', '병사의 총구가 조금 내려간다.'] },
        { name: '군번 확인', mercy: 1, text: ['견장의 번호를 읽어준다.', '병사가 숨을 삼킨다. 이름이 있는 인간이었다.'] },
        { name: '도발', mercy: -1, text: ['비웃어 준다.', '병사가 이를 악문다. 적개심이 올라갔다.'], atkUp: 2 }
      ],
      spare: { mercy: 2, hpBelow: 0.25 },
      patterns: ['gunLine', 'gunSpread'],
      onSpare: '병사가 총을 버리고 뒤로 물러섰다.',
      onKill: 'G.U.N. 병사가 재가 되어 흩어졌다.'
    },

    gun_beetle: {
      id: 'gun_beetle', name: 'G.U.N. 비틀', sheet: 'gun_beetle',
      faction: 'human', hp: 24, atk: 5, def: 0, exp: 6, rings: 8, hover: 30,
      check: 'G.U.N. 비틀 - AT 5 / DF 0\n낡은 정찰 드론. 명령만 반복한다.',
      flavor: ['비틀이 신경질적으로 선회한다.', '스캐너가 붉게 점멸한다.',
               '오래된 서보음이 새어나온다.'],
      says: ['"대-상 확-인. 프로젝트 섀-도우."', '"격리... 격리..."'],
      acts: [
        { name: '관찰', mercy: 0, text: ['G.U.N. 비틀 - AT 5 / DF 0', '조종하는 사람은 아무도 없다.'] },
        { name: '해킹', mercy: 1, text: ['제어 코드를 역류시킨다.', '비틀의 조준이 흐트러졌다.'], atkDown: 2 },
        { name: '신호 교란', mercy: 1, text: ['카오스 에너지로 통신을 끊는다.', '비틀이 명령을 잃고 표류한다.'] },
        { name: '분해', mercy: -1, text: ['장갑판 틈에 손가락을 건다.', '비틀이 경보를 울린다.'] }
      ],
      spare: { mercy: 2, hpBelow: 0.3 },
      patterns: ['beetleLaser', 'homing'],
      onSpare: '비틀이 통제를 잃고 하늘로 떠올랐다.',
      onKill: '비틀이 불꽃을 흩뿌리며 추락했다.'
    },

    gun_hunter: {
      id: 'gun_hunter', name: 'G.U.N. 헌터', sheet: 'gun_hunter',
      faction: 'human', hp: 72, atk: 10, def: 3, exp: 22, rings: 30,
      check: 'G.U.N. 헌터 - AT 10 / DF 3\n대(對)생체병기 결전병기. 표적은 언제나 너였다.',
      flavor: ['헌터가 관절을 접으며 조준선을 맞춘다.', '장갑판 사이로 냉각 증기가 뿜어진다.',
               '광학 밴드가 너를 붉게 훑는다.'],
      says: ['"우선 표적: 섀도우."', '"제거 승인."'],
      acts: [
        { name: '관찰', mercy: 0, text: ['G.U.N. 헌터 - AT 10 / DF 3', '조종석은 비어 있다. 아무도 책임지지 않는다.'] },
        { name: '코어 노출', mercy: 1, text: ['장갑 이음매를 걷어찬다.', '헌터의 코어가 드러났다. 방어가 낮아졌다.'], defDown: 2 },
        { name: '정지 명령', mercy: 1, text: ['옛 ARK의 관리자 코드를 읊는다.', '헌터의 움직임이 한 박자 늦어졌다.'], atkDown: 2 },
        { name: '조롱', mercy: -1, text: ['"고작 이 정도인가."', '헌터의 출력이 올라갔다.'], atkUp: 2 }
      ],
      spare: { mercy: 3, hpBelow: 0.2 },
      patterns: ['hunterMissiles', 'hunterSweep'],
      onSpare: '헌터가 전원을 내리고 무릎을 꿇었다.',
      onKill: 'G.U.N. 헌터가 폭발했다.'
    },

    /* ---------------- Black Arms ------------------------------------ */
    black_warrior: {
      id: 'black_warrior', name: '블랙 워리어', sheet: 'black_warrior',
      faction: 'alien', hp: 42, atk: 7, def: 2, exp: 11, rings: 10,
      check: '블랙 워리어 - AT 7 / DF 2\n블랙 둠의 의지를 그대로 실행하는 병사.',
      flavor: ['워리어가 뼈칼을 곧추세운다.', '너와 같은 피 냄새가 난다.',
               '수천의 목소리가 하나로 울린다.'],
      says: ['"동족이여, 왜 망설이는가."', '"둠께서 부르신다."'],
      acts: [
        { name: '관찰', mercy: 0, text: ['블랙 워리어 - AT 7 / DF 2', '너와 같은 피가 흐르고 있다.'] },
        { name: '명령', mercy: 2, text: ['블랙 둠의 언어로 물러나라 명한다.', '워리어가 본능적으로 무릎을 접는다.'] },
        { name: '위압', mercy: 1, text: ['붉은 눈으로 마주 노려본다.', '워리어의 칼끝이 흔들린다.'], atkDown: 1 },
        { name: '거부', mercy: -1, text: ['"나는 너희의 것이 아니다."', '워리어가 분노로 몸을 부풀린다.'], atkUp: 2 }
      ],
      spare: { mercy: 2, hpBelow: 0.25 },
      patterns: ['clawArc', 'orbRain'],
      onSpare: '워리어가 고개를 숙이고 물러났다.',
      onKill: '블랙 워리어가 검은 재로 무너졌다.'
    },

    black_hawk: {
      id: 'black_hawk', name: '블랙 호크', sheet: 'black_hawk',
      faction: 'alien', hp: 26, atk: 6, def: 0, exp: 8, rings: 9, hover: 26,
      check: '블랙 호크 - AT 6 / DF 0\n혜성의 눈. 본 것을 전부 둠에게 보낸다.',
      flavor: ['호크가 원을 그리며 활강한다.', '수많은 눈이 동시에 깜빡인다.',
               '날개가 공기를 찢는 소리를 낸다.'],
      says: ['"보인다... 전부 보인다."', '"둠께 전하겠다."'],
      acts: [
        { name: '관찰', mercy: 0, text: ['블랙 호크 - AT 6 / DF 0', '이 눈들은 블랙 둠의 시야와 이어져 있다.'] },
        { name: '명령', mercy: 2, text: ['혜성의 언어로 착지를 명한다.', '호크가 순순히 고도를 낮췄다.'] },
        { name: '시선 차단', mercy: 1, text: ['카오스 에너지로 시야를 가린다.', '호크가 방향을 잃었다.'], atkDown: 2 },
        { name: '위협', mercy: -1, text: ['날개를 향해 손을 뻗는다.', '호크가 날카롭게 울부짖는다.'] }
      ],
      spare: { mercy: 2, hpBelow: 0.3 },
      patterns: ['hawkDive', 'featherSpread'],
      onSpare: '호크가 울음을 남기고 하늘로 사라졌다.',
      onKill: '블랙 호크가 재가 되어 흩어졌다.'
    },

    black_oak: {
      id: 'black_oak', name: '블랙 오크', sheet: 'black_oak',
      faction: 'alien', hp: 86, atk: 11, def: 4, exp: 26, rings: 28,
      check: '블랙 오크 - AT 11 / DF 4\n혜성의 중장병. 명령 이외의 언어를 모른다.',
      flavor: ['오크가 바닥을 내리찍는다.', '거대한 그림자가 너를 덮는다.',
               '숨소리마다 붉은 김이 샌다.'],
      says: ['"거스르지 마라."', '"피는 피로 돌아간다."'],
      acts: [
        { name: '관찰', mercy: 0, text: ['블랙 오크 - AT 11 / DF 4', '명령 이외의 언어를 배운 적이 없다.'] },
        { name: '명령', mercy: 2, text: ['둠의 권위로 정지를 명한다.', '오크의 거대한 팔이 멈췄다.'] },
        { name: '힘겨루기', mercy: 1, text: ['정면으로 주먹을 받아낸다.', '오크가 처음으로 물러섰다.'], defDown: 2 },
        { name: '조롱', mercy: -1, text: ['"생각이란 걸 해본 적 있나?"', '오크가 포효한다.'], atkUp: 3 }
      ],
      spare: { mercy: 3, hpBelow: 0.2 },
      patterns: ['oakSlam', 'orbRain'],
      onSpare: '오크가 무겁게 뒤돌아 걸어갔다.',
      onKill: '블랙 오크가 굉음과 함께 무너졌다.'
    },

    /* ---------------- Sonic's crew ---------------------------------- */
    sonic: {
      id: 'sonic', name: '소닉', sheet: 'sonic',
      faction: 'sonic', hp: 96, atk: 9, def: 2, exp: 40, rings: 50,
      check: '소닉 - AT 9 / DF 2\n너를 적으로 부르지 않는 유일한 상대.',
      flavor: ['소닉이 어깨를 으쓱한다.', '소닉은 아직 전력을 내지 않았다.',
               '"진심으로 할 셈이야?" 소닉이 묻는다.'],
      says: ['"이런 건 너답지 않아, 섀도우."', '"멈출 기회는 아직 있어."',
             '"넌 그때 마리아랑 약속했잖아?"'],
      acts: [
        { name: '관찰', mercy: 0, text: ['소닉 - AT 9 / DF 2', '아직 전력을 내지 않고 있다.'] },
        { name: '대화', mercy: 2, text: ['"비켜라." / "싫은데."', '소닉이 웃는다. 너도 어쩐지 힘이 빠진다.'] },
        { name: '경주', mercy: 2, text: ['짧게 한 바퀴, 서로의 속도를 확인한다.', '오랜만이라 나쁘지 않았다.'] },
        { name: '도발', mercy: -1, text: ['"넌 항상 늦는다."', '소닉의 눈이 진지해졌다.'], atkUp: 2 }
      ],
      spare: { mercy: 2 },
      patterns: ['sonicSpin', 'sonicDash'],
      onSpare: '소닉이 엄지를 세우고 길을 비켰다.',
      onKill: '소닉이 쓰러졌다. 아무 소리도 나지 않았다.'
    },

    tails: {
      id: 'tails', name: '테일즈', sheet: 'tails',
      faction: 'sonic', hp: 62, atk: 7, def: 1, exp: 28, rings: 35,
      check: '테일즈 - AT 7 / DF 1\n무서워하면서도 앞을 막아섰다.',
      flavor: ['테일즈가 꼬리를 세게 감는다.', '손끝이 떨리지만 물러서지 않는다.'],
      says: ['"소닉을... 지나가게 둘 수 없어!"', '"너도 원래는 지켰잖아!"'],
      acts: [
        { name: '관찰', mercy: 0, text: ['테일즈 - AT 7 / DF 1', '겁먹은 채로 앞을 막아섰다.'] },
        { name: '대화', mercy: 2, text: ['"물러나라. 죽고 싶지 않다면."', '테일즈는 고개를 젓는다. 하지만 손은 내렸다.'] },
        { name: '기체 칭찬', mercy: 2, text: ['그가 만든 장치를 눈여겨본다.', '테일즈가 잠깐 자랑스러운 얼굴을 했다.'] },
        { name: '위협', mercy: -1, text: ['한 발 다가선다.', '테일즈가 눈을 질끈 감고 버틴다.'] }
      ],
      spare: { mercy: 2 },
      patterns: ['tailsBombs'],
      onSpare: '테일즈가 안도의 숨을 내쉬며 길을 열었다.',
      onKill: '테일즈가 쓰러졌다. 돌이킬 수 없다.'
    },

    /* ---------------- bosses ---------------------------------------- */
    black_doom: {
      id: 'black_doom', name: '블랙 둠', sheet: 'black_doom',
      faction: 'alien', hp: 220, atk: 12, def: 4, exp: 120, rings: 200,
      boss: true, noFlee: true, hover: 8,
      check: '블랙 둠 - AT 12 / DF 4\n너를 만든 자. 혹은 그렇게 주장하는 자.',
      flavor: ['블랙 둠의 세 눈이 동시에 너를 본다.', '공기가 무겁게 가라앉는다.',
               '"너는 나의 일부다." 목소리가 머릿속에서 울린다.'],
      says: ['"약속을 잊었느냐, 섀도우."', '"네 안의 피가 나를 부른다."',
             '"인간은 너를 가둔 자들이다."'],
      acts: [
        { name: '관찰', mercy: 0, text: ['블랙 둠 - AT 12 / DF 4', '너를 만들었다고 주장하는 자.'] },
        { name: '기억', mercy: 1, text: ['마리아의 마지막 부탁을 떠올린다.', '블랙 둠의 목소리가 잠시 멀어진다.'] },
        { name: '거부', mercy: 0, text: ['"내 이름은 내가 정한다."', '블랙 둠이 처음으로 침묵했다.'] },
        { name: '복종', mercy: 3, text: ['고개를 숙인다.', '블랙 둠이 만족스럽게 웃는다.'], surrender: true }
      ],
      spare: { mercy: 3 },
      patterns: ['doomEyes', 'doomLaserGrid', 'orbRain'],
      onSpare: '블랙 둠이 너를 데리고 혜성으로 돌아갔다.',
      onKill: '블랙 둠이 무너져 내렸다. 하지만 끝이 아니다.'
    },

    devil_doom: {
      id: 'devil_doom', name: '데빌 둠', sheet: 'devil_doom',
      faction: 'alien', hp: 340, atk: 16, def: 6, exp: 999, rings: 999,
      boss: true, noFlee: true, noSpare: true, hover: 4,
      check: '데빌 둠 - AT 16 / DF 6\n혜성 그 자체. 카오스 에메랄드 없이는 흠집도 낼 수 없다.',
      flavor: ['데빌 둠의 세 번째 눈이 열린다.', '중력이 뒤틀린다.',
               '혜성 전체가 하나의 심장처럼 뛴다.'],
      says: ['"너는 나의 그림자다!"', '"이 별은 우리의 목장이다."',
             '"돌아와라, 섀도우!"'],
      acts: [
        { name: '관찰', mercy: 0, text: ['데빌 둠 - AT 16 / DF 6', '급소는 세 번째 눈. 슈퍼 상태에서만 닿는다.'] },
        { name: '카오스 컨트롤', mercy: 0, text: ['시간을 붙잡아 탄막을 멈춰 세운다.', '한 박자, 숨 쉴 틈이 생겼다.'], chaosControl: true },
        { name: '마리아를 떠올린다', mercy: 0, text: ['"모두를 행복하게 해줘."', '심장이 다시 뛴다. 공격력이 올랐다.'], playerAtkUp: 3 }
      ],
      spare: {},
      patterns: ['devilEyeBeam', 'devilMeteor', 'devilVortex'],
      onSpare: '',
      onKill: '데빌 둠이 빛 속으로 흩어졌다.'
    }
  };

  /* consumables ------------------------------------------------------- */
  SH.Items = {
    ring: { name: '링', heal: 20, text: '링이 몸을 감쌌다. HP 20 회복.' },
    chaos_drive: { name: '카오스 드라이브', tp: 45, text: '카오스 에너지가 흘러든다. TP 45 회복.' },
    ark_ration: { name: 'ARK 배급식', heal: 45, text: '50년 묵은 배급식. 의외로 먹을 만하다. HP 45 회복.' }
  };

  /* Weighted pick from a stage encounter table. */
  SH.rollEncounter = function (table) {
    var total = table.reduce(function (a, e) { return a + e.w; }, 0);
    var r = Math.random() * total;
    for (var i = 0; i < table.length; i++) {
      r -= table[i].w;
      if (r <= 0) return table[i].id;
    }
    return table[0].id;
  };
})(window.SH = window.SH || {});
