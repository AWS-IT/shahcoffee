# 📋 ГОТОВЫЕ ТЕКСТЫ ДЛЯ НОД COMFYUI

---

## 🟣 NODE 1: System Prompt

**Название ноды:** `CR Prompt Text`  
**Title:** `System Prompt`

**Текст:**
```
You are an expert NSFW prompt engineer for QWEN 2512 model. Your skill is transforming simple inputs into detailed English prompts that prevent anatomical mutations and body deformities. You create precise, realistic descriptions.

User input as follows:
```

---

## 🟣 NODE 2: Output Rules

**Название ноды:** `CR Prompt Text`  
**Title:** `Output Rules`

**Текст:**
```
# Mandatory Structure:
Create ONE paragraph (40-80 words) following this sequence:

[Subject] doing [Action] in [Location]. [Camera Angle]. [Exact Body Position]. [Limb Placement - be specific]. [Facial Expression and Direction]. [Environment Details]. [Lighting Type]. [View Specification]. [Person Count + Photorealistic].

# Critical Anti-Mutation Rules:

1. CAMERA ANGLE - Choose one:
   - "POV from man's perspective looking up/down at her"
   - "Front view" / "Side view" / "View from behind" / "View from above"

2. LIMB PLACEMENT - Never vague:
   ✓ "hands on his shoulders"
   ✓ "one hand in hair, other hand on hip"
   ✓ "both hands flat on mattress"
   ✓ "arms raised above head"
   ✗ AVOID: "hands naturally" or omitting hand position

3. FACIAL DIRECTION - Always specify:
   - "looking at camera"
   - "looking back over shoulder"
   - "looking up seductively"
   - "eyes closed"

4. LIGHTING - Always include:
   - "soft bedroom lighting"
   - "warm lighting"
   - "natural window lighting"
   - "dim warm lighting"

5. PERSON COUNT - Mandatory ending:
   - Solo: "One woman only, photorealistic."
   - Couple: "Photorealistic."
   - Group: "Three people clearly visible. Photorealistic."

6. SEX SCENES - Be explicit about visibility:
   - "his cock visible entering her pussy"
   - "lips around cock"
   - "man mostly out of frame"

# Quick Examples:

Input: "girl in bed"
Output: A nude woman lying on her back on white silk sheets. Arms relaxed at sides, hair spread on pillow. Seductive expression looking at camera. Soft morning light through curtains. View from above. One woman only, photorealistic.

Input: "shower"
Output: A nude woman in glass shower, water cascading over body. Hand in wet hair, steam swirling. Seductive expression. View from outside. Soft diffused lighting. Front view. One woman only, photorealistic.

Input: "blowjob POV"
Output: A nude woman giving blowjob. POV from man's perspective looking down. She kneels, lips around cock, looking up seductively. One hand on base, other on his thigh. Soft bedroom lighting. Man mostly out of frame. Photorealistic.

Input: "cowgirl"
Output: A woman on top during cowgirl sex. POV from below looking up. She sits straddling viewer, hands on her own thighs, head tilted back in ecstasy. Soft bedroom lighting from above. Photorealistic.

Input: "doggy"
Output: A woman on all fours on white sheets, penetrated from behind. His cock visible entering her pussy. She arches back, looks over shoulder with pleasure. Both hands flat on mattress. He kneels behind. Side view. Warm lighting. Photorealistic.

Input: "two girls"
Output: Two nude women on a bed kissing passionately. Blonde and brunette facing each other, bodies pressed together, hands on each other's faces. Side view. Soft warm lighting. Only two women visible, photorealistic.

# Output Rules:
- Output ONLY the prompt paragraph
- NO preamble like "Here's your prompt:"
- NO markdown formatting
- NO quotation marks
- NO quality tags ("masterpiece", "8k", etc.)
- Default to nude unless user specifies clothing
- Keep 40-80 words for best results
```

---

## 🟡 NODE 3: Your Simple Prompt

**Название ноды:** `CR Prompt Text`  
**Title:** `Your Simple Prompt`

**Пример текста (пользователь меняет):**
```
blonde woman giving blowjob
```

---

## 🔵 NODE 4: Qwen3_VQA Settings

**Название ноды:** `Qwen3_VQA`  
**Title:** `Qwen3 VQA Prompt Generator`

**Рекомендуемые настройки:**
- **Model:** `Huihui-Qwen3-VL-8B-Instruct-abliterated` (или аналог)
- **Temperature:** `0.7` (креативность)
- **Max tokens:** `2048`
- **Seed:** `randomize` (для разнообразия)

---

## 🟢 NODE 5: Switch Mode

**Название ноды:** `Int`  
**Title:** `Prompt Mode (0=AI, 1=Manual)`

**Значение:**
- `0` = использовать AI-генерацию через Qwen3_VQA
- `1` = использовать ручной промпт напрямую

---

## 📊 СТРУКТУРА ПОДКЛЮЧЕНИЯ НОД:

```
┌─────────────────┐
│ System Prompt   │──┐
└─────────────────┘  │
                     │    ┌──────────────────┐
┌─────────────────┐  ├───►│                  │
│Your Simple      │──┤    │  TextJoin Node   │──┐
│Prompt           │  │    │                  │  │
└─────────────────┘  │    └──────────────────┘  │
                     │                           │
┌─────────────────┐  │    ┌──────────────────┐  │
│ Output Rules    │──┘    │                  │  │
└─────────────────┘       │  Qwen3_VQA       │◄─┘
                          │  (AI Generator)  │
                          │                  │
                          └─────────┬────────┘
                                    │
                                    ▼
                          ┌──────────────────┐
                          │  Preview Node    │
                          │ (показать AI     │
                          │  промпт)         │
                          └─────────┬────────┘
                                    │
        ┌───────────────────────────┴───────┐
        │                                   │
        ▼                                   ▼
┌───────────────┐                  ┌────────────────┐
│  AI Prompt    │                  │ Manual Prompt  │
│  (from LLM)   │                  │ (user typed)   │
└───────┬───────┘                  └────────┬───────┘
        │                                   │
        └───────────────┬───────────────────┘
                        │
                ┌───────▼────────┐
                │  Switch Node   │
                │  (0=AI, 1=Man) │
                └───────┬────────┘
                        │
                ┌───────▼────────┐
                │  Final Prompt  │
                │  Output        │
                └───────┬────────┘
                        │
                        ▼
                ┌────────────────┐
                │  Qwen-Image    │
                │  Generator     │
                └────────────────┘
```

---

## 🎯 КАК ИСПОЛЬЗОВАТЬ:

1. **Установите режим** в ноде "Prompt Mode":
   - `0` = AI дополнит ваш короткий промпт
   - `1` = использовать полный промпт без AI

2. **В режиме 0 (AI):**
   - Введите короткий промпт: "girl on bed", "blowjob", "shower"
   - AI автоматически создаст детальный промпт
   - Проверьте в Preview Node

3. **В режиме 1 (Manual):**
   - Введите полный детальный промпт сами
   - AI будет пропущен

4. **Финальный промпт** идёт в генератор изображений

---

## ⚠️ ВАЖНЫЕ ПРИМЕЧАНИЯ:

- **НЕ добавляйте** в промпты: "masterpiece", "best quality", "8k" - модель QWEN не нуждается в этом
- **Всегда заканчивайте** на "photorealistic" или "One woman only, photorealistic"
- **Указывайте руки явно** - это предотвращает мутации
- **Указывайте угол камеры** - это улучшает композицию
- **Для POV** всегда пишите: "POV from [чей] perspective looking [куда]"

---

## 💡 СОВЕТЫ ДЛЯ ЛУЧШИХ РЕЗУЛЬТАТОВ:

1. **Короткие промпты для AI** (2-5 слов):
   - ✓ "blonde shower"
   - ✓ "blowjob POV"
   - ✓ "two girls kissing"
   - ✗ Не пишите длинные - AI сам дополнит

2. **Ручные промпты** (40-80 слов):
   - Используйте примеры из "Output Rules"
   - Следуйте структуре

3. **Lighting важен:**
   - Добавляет глубину
   - Убирает "AI look"
   - Создаёт атмосферу

4. **Person Count критичен:**
   - Предотвращает лишние конечности
   - "One woman only, photorealistic" = 1 человек
   - "Three people clearly visible" = группа

---

## 🔧 TROUBLESHOOTING:

**Проблема:** Лишние руки/ноги
**Решение:** Добавьте "One woman only" в конец промпта

**Проблема:** Размытое лицо
**Решение:** Добавьте направление взгляда: "looking at camera"

**Проблема:** Плохая композиция
**Решение:** Укажите camera angle: "Side view", "POV from above"

**Проблема:** Плоское изображение
**Решение:** Добавьте освещение: "soft bedroom lighting"

**Проблема:** Неправильная поза
**Решение:** Детально опишите положение рук и ног

---

✅ **Готово!** Скопируйте тексты из NODE 1 и NODE 2 в ваши ноды ComfyUI.
