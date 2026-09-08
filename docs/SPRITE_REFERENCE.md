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
* **머즐** — 두개골 밖으로 2px 정도만 나오는 짧은 주둥이. 코는 살색에 완전히 둘러싸이도록
  배치해야 실루엣 외곽선이 아니라 코로 읽힌다. 입은 앞쪽 아래 1px.
* **눈** — 뒤쪽 모서리가 높고 뾰족한 쐐기꼴, 두꺼운 검은 눈꺼풀, 앞쪽으로 밀린 홍채 + 동공 + 반사광.

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
