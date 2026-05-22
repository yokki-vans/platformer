# Skyward Sprout

**Skyward Sprout** — оригинальный вертикальный endless-jumper для браузера на чистых HTML/CSS/JavaScript и Canvas API. Без backend, сборщиков и сторонних игровых ассетов.

Игрок управляет маленьким ростком, который автоматически прыгает от платформ, поднимается через меняющиеся биомы, собирает орбы и бонусы, избегает шипов и летающих врагов. Рекорд и mute-настройка сохраняются в `localStorage`.

## Live

- GitHub Pages: https://yokki-vans.github.io/platformer/
- Repository: https://github.com/yokki-vans/platformer

## Управление

### Desktop

- `←` / `→` — движение
- `A` / `D` — движение
- `Space` / `Enter` — старт, рестарт, экстренный прыжок при активном бонусе Double Jump
- `P` / `Esc` — пауза

### Mobile

- Левая/правая кнопка внизу экрана — движение
- Центральная кнопка — экстренный прыжок, если активен бонус Double Jump
- Layout использует `100dvh`, safe-area insets и flex-структуру: root flex column, canvas panel `flex: 1; min-height: 0`, controls ниже canvas.
- На desktop мобильные кнопки скрыты; на touch/mobile viewport — большие доступные кнопки без вертикального скролла.

## Фичи

- Бесконечная вертикальная генерация платформ.
- Auto-jump после приземления.
- Горизонтальное движение с edge wrap.
- Камера плавно скроллит вверх и не опускается назад.
- Height, score, best score, biome HUD.
- Best score и mute state сохраняются в `localStorage`.
- Состояния: start, playing, pause, game over, restart.
- Reachability validation:
  - генератор рассчитывает `maxJumpHeight = jumpVelocity² / (2 * gravity)`;
  - учитывает air time и максимальный горизонтальный reach;
  - вертикальные и горизонтальные gaps держатся внутри safe margin;
  - hazard-платформа не становится обязательной точкой маршрута;
  - при spike/hazard платформе создаётся безопасная альтернативная платформа.
- Типы платформ:
  - normal
  - moving
  - fragile/breaking
  - boost
  - hazard/spike
- Бонусы:
  - Spring boost
  - Jetpack / temporary flight
  - Shield
  - Magnet
  - Double / emergency jump
  - Score Multiplier
  - Low Gravity
- Коллекционные орбы дают score.
- Magnet притягивает collectibles.
- Spikes и flying enemy завершают run, если нет shield.
- Shield поглощает один hazard hit.
- Биомы по высоте:
  - 0–500: grass/sky
  - 500–1200: clouds
  - 1200–2200: snow/ice
  - 2200–3500: space
  - 3500+: neon/cosmic
- Биомы меняют фон, цвета платформ, particles, label и переходят плавно.
- Canvas-анимации:
  - player movement/jump/fall/boost
  - squash/stretch
  - landing particles
  - collectible/perk bob/rotation
  - game over shake
  - biome transition flash
- Web Audio API sounds без внешних файлов:
  - jump
  - collect
  - perk
  - shield/damage
  - game over
  - biome transition
  - button click

## Локальный запуск

Можно открыть `index.html` напрямую или запустить статический сервер:

```bash
python3 -m http.server 8080
```

Затем открыть:

```text
http://localhost:8080/
```

## Структура

```text
/index.html
/styles.css
/game.js
/README.md
/.github/workflows/pages.yml
```

## Проверки

Выполненные локальные проверки:

- `node --check game.js`
- HTML parse через Python `html.parser`
- YAML parse workflow
- `git diff --check`
- Desktop runtime через headless Chrome/CDP:
  - start/restart
  - Arrow/A-D movement
  - pause/resume
  - shield hit absorption
  - score multiplier effect
  - game over state
- Mobile runtime/layout через headless Chrome/CDP:
  - viewport 390×844 и 360×640
  - `docH == innerH`, нет page scroll
  - mobile controls visible and inside viewport
  - canvas uses remaining height above controls
  - pointerdown/pointerup on mobile right button changes movement state
- Procedural generation validation:
  - generated sample path to 9000px height
  - unreachable anchors: 0
  - hazard-only paths: 0

## Deployment

Репозиторий настроен под GitHub Pages через GitHub Actions workflow `.github/workflows/pages.yml`.

После push в ветку `master` workflow публикует корень репозитория на GitHub Pages:

```text
https://yokki-vans.github.io/platformer/
```

## Known limitations

- Это статическая single-player arcade game без серверного leaderboard.
- Web Audio запускается только после первого пользовательского взаимодействия — это требование браузеров.
- Touch layout проверен headless-эмуляцией viewport; финальная визуальная проверка на реальном телефоне всё равно полезна из-за различий mobile browser UI/safe-area.
