# 스프라이트 레퍼런스 노트 / Sprite reference notes

## 조사한 것

기획서의 지시대로 16비트 사이드뷰 스프라이트의 실제 사양을 웹에서 조사했다.

* GBA 계열 소닉 스프라이트(《Sonic Advance》, 《Sonic Battle》)의 시트가
  The Spriters Resource / Sonic Galaxy / Sprite Database 등에 정리되어 있다는 것은 확인했으나,
  **정확한 프레임 픽셀 치수를 명시한 1차 자료는 검색 결과에 없었다.**
  GBA 하드웨어의 OBJ 규격(8×8 타일, 스프라이트 최대 64×64)과 시트 구성으로부터
  캐릭터 1프레임이 대략 **32~40px 폭 / 36~44px 높이** 범위라는 것을 역산해 기준으로 삼았다.
* 섀도우의 디자인 사양은 다음을 확인해 그대로 반영했다.
  * 검은 털, **붉은 눈**, 가슴의 **흰 털 뭉치**, 황갈색 머즐, 검은 코
  * 머리 가시 **6개** — 4개는 위로, 2개는 아래로
  * **붉은 줄무늬**: 각 머리 가시, 눈 가장자리, 팔과 다리
  * 흰 장갑 + 검은 커프 + 붉은 텅
  * 에어 슈즈: 검은 커프 / 붉은 텅 / 흰·붉은 액센트 / 제트 분사구
  * 손목과 발목의 **금색 리미터 링**

이 사양은 `tools/chars.py` 의 `_shadow_quills()`, `_head()`, `_leg()`, `_arm()` 에
그대로 코드로 들어가 있다.

레퍼런스를 보고 맞춘 비율 기준:

* **가시** — 굵고 완만하게 뒤로 쓸린 사다리꼴 4개(위) + 등가시 1개. 각도로 벌려 사이에 1px
  틈이 남게 한다. 붉은 줄무늬는 각 가시의 윗면을 따라 1px로 얇게 흐른다.
* **머즐과 코의 관계** — 원본에서 옆얼굴 실루엣을 깨는 건 **코 하나뿐이다**.
  살색 주둥이는 두개골 실루엣 **안쪽(-1px)** 에 머물고, 검은 코만 그 앞으로 **+3px**
  혹처럼 튀어나온다. 코는 머즐 위쪽에 얹히고 머즐 아래쪽은 뒤로 물러나 턱선을 만든다.
  (주둥이째로 내밀면 얼굴이 주둥이에 먹히고, 반대로 주둥이를 너무 깊이 넣으면
  앞에 털이 한 겹 둘러 부리처럼 보인다. 코만 내미는 것이 정답이다.)
* **입은 그리지 않는다.** 원본 소닉 계열 스프라이트는 특정 표정에서만 입을 넣고,
  기본 대기/이동 프레임에는 입이 없다.
* **눈** — 작고 단정한 타원(8×6). 크게 그리면 얼굴이 눈으로 꽉 차서 원본과 멀어진다.
  아래 앞모서리가 머즐 위에 걸치도록 앉히고, 홍채는 앞쪽으로 밀어 동공을 그 안에 둔다.
  섀도우는 눈꺼풀 위를 따라 붉은 테두리가 지난다.
  윗눈꺼풀은 앞쪽으로 **1픽셀 기울여** 내린다 — 사납게 찌푸릴 필요는 없고, 이 1px 차이가
  수평 눈매의 순한 인상을 지운다.
* **턱선** — 머즐만 얹으면 살색 덩어리가 두상에 녹아버린다. 턱 끝에서 뒤로 흐르는
  볼 선(털색 1px)과 그 아래 윤곽선(검정 1px), 두 줄을 그어 머즐을 두상에서 떼어놓는다.
* **에어 슈즈의 화염** — 분사는 **스케이터의 뒤쪽 한 점**에 고정하고 애니메이션 위상에
  맞춰 맥동시킨다. 발마다 불을 달면 발을 쫓아다니는 두 개의 불덩이로 읽히고,
  추진이 아니라 '불붙은 신발로 달리는' 그림이 된다.
* **오버월드(작은) 스프라이트** — 두상이 14px 남짓이라 전투용 머즐을 그대로 줄이면
  주둥이만 튀어나온 얼굴이 된다. 규칙은 전투 두상과 같다: 살색 머즐은 두개골 원
  **안쪽**에 완전히 들어가 눈매 가까이까지 물리고, 실루엣 밖으로 나가는 것은
  **검은 코 쐐기 2픽셀뿐**이다(코를 키우는 것이 아니라 앞으로 내미는 것).
  살색이 실루엣을 넘어가는 순간 주둥이 얼굴이 된다.

## 왜 실제 게임 스프라이트를 커밋하지 않았는가

《Sonic Advance》·《Sonic Battle》·《Sonic Mania》의 스프라이트 시트는 **세가(SEGA)의 저작물**이다.
스프라이트 리핑 사이트에서 받은 파일을 이 저장소에 넣어 배포하면 저작권 침해가 된다.

그래서 이 프로젝트는 **레퍼런스의 비율·구도·색 구성만 기준으로 삼고,
스프라이트 자체는 전부 코드로 새로 그렸다** (`tools/`).
임의의 단색 도형이나 무작위 이미지가 아니라, 두상·가시·머즐·눈·가슴 털·장갑·에어 슈즈·리미터 링까지
디자인 사양을 따라 픽셀 단위로 조립한 오리지널 픽셀 아트다.

직접 그린 그림이나 소유한 에셋을 쓰고 싶다면 언제든 교체할 수 있다 —
README 의 "자신의 스프라이트로 교체하기" 참고. 렌더링 코드를 건드릴 필요는 없다.

## 참고한 검색 결과

* [Sonic Advance — The Spriters Resource](https://www.spriters-resource.com/game_boy_advance/sonicadv/)
* [Sonic Advance Sprite Sheets — Sonic Galaxy.net](https://www.sonicgalaxy.net/sprites-gba-sa/)
* [Sonic Battle Sprite Sheets — Sonic Galaxy.net](https://www.sonicgalaxy.net/sprites-gba-sb/)
* [Sprite Database — Sonic Advance](https://spritedatabase.net/game/1132)
* [Shadow (Advance-Style) — The Spriters Resource (custom)](https://www.spriters-resource.com/custom_edited/sonicthehedgehogcustoms/asset/18221/)
* [Shadow the Hedgehog — Sonic Wiki Zone](https://sonic.fandom.com/wiki/Shadow_the_Hedgehog)
* [Shadow the Hedgehog — Grokipedia](https://grokipedia.com/page/Shadow_the_Hedgehog)
