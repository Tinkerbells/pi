---
name: storybook-vue
description: Создание типизированных историй Storybook для Vue 3 в формате CSF3. Использовать при покрытии Vue-компонентов историями, настройке args, controls, slots, состояний и autodocs.
license: MIT
metadata:
  author: Tinkerbells
  version: "0.0.1"
---

# Storybook - Написание историй (Vue)

## Ключевые концепции

### Component Story Format 3 (CSF3)

CSF3 — это современный формат Storybook, использующий объектный синтаксис для описания историй:

```typescript
import type { Meta, StoryObj } from "@storybook/vue3-vite";
import Button from "./Button.vue";

const meta = {
  title: "Components/Button",
  component: Button,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    backgroundColor: { control: "color" },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    primary: true,
    label: "Button",
  },
};

export const Secondary: Story = {
  args: {
    label: "Button",
  },
};
```

### Организация историй

- Одна история на компонент: `Component.stories.ts`
- Используйте описательные имена историй: `Primary`, `Secondary`, `Large`, `Disabled`
- Группируйте связанные истории с помощью иерархии в `title`: `Components/Forms/Input`

### Экспорт по умолчанию (Meta)

Экспорт по умолчанию определяет метаданные для всех историй в файле:

```typescript
const meta = {
  title: "Components/Button", // Путь в навигации
  component: Button, // Ссылка на компонент
  parameters: {}, // Конфигурация на уровне истории
  tags: ["autodocs"], // Включение автодокументации
  argTypes: {}, // Настройка элементов управления (controls)
  decorators: [], // Обертки для историй
} satisfies Meta<typeof Button>;
```

## Лучшие практики

### 1. Используйте TypeScript для строгой типизации

```typescript
import type { Meta, StoryObj } from "@storybook/vue3-vite";
import Button from "./Button.vue";

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

type Story = StoryObj<typeof meta>;
```

### 2. Демонстрируйте все состояния компонента

Создавайте отдельные истории для каждого значимого состояния:

```typescript
export const Default: Story = {
  args: {
    label: "Нажми на меня",
  },
};

export const Loading: Story = {
  args: {
    label: "Загрузка...",
    loading: true,
  },
};

export const Disabled: Story = {
  args: {
    label: "Неактивна",
    disabled: true,
  },
};

export const WithIcon: Story = {
  args: {
    label: "Скачать",
    icon: "download",
  },
};
```

### 3. Используйте разумные значения по умолчанию

```typescript
export const Primary: Story = {
  args: {
    primary: true,
    label: "Button",
    size: "medium",
  },
};

// Расширение существующих историй
export const PrimaryLarge: Story = {
  ...Primary,
  args: {
    ...Primary.args,
    size: "large",
  },
};
```

### 4. Добавляйте описательные параметры

```typescript
export const WithTooltip: Story = {
  args: {
    label: "Наведи курсор",
    tooltip: "Нажмите для отправки",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Показывает тултип при наведении для предоставления дополнительного контекста.",
      },
    },
  },
};
```

### 5. Используйте декораторы для контекста

В Vue декораторы могут возвращать компоненты с шаблонами:

```typescript
import Navigation from "./Navigation.vue";

const meta = {
  component: Navigation,
  decorators: [
    () => ({
      template: '<div style="padding: 3rem;"><story /></div>',
    }),
  ],
} satisfies Meta<typeof Navigation>;
```

## Общие паттерны

### Компоненты форм

```typescript
export const EmptyForm: Story = {
  args: {
    onSubmit: (data: any) => console.log(data),
  },
};

export const PrefilledForm: Story = {
  args: {
    defaultValues: {
      email: "user@example.com",
      name: "Иван Иванов",
    },
  },
};

export const WithValidationErrors: Story = {
  args: {
    errors: {
      email: "Неверный формат email",
      name: "Имя обязательно для заполнения",
    },
  },
};
```

### Компоненты макета (Layouts) с использованием слотов

Для компонентов со слотами (slots) можно использовать функцию `render`:

```typescript
import Layout from "./Layout.vue";
import Sidebar from "./Sidebar.vue";
import Content from "./Content.vue";

export const WithSidebar: Story = {
  render: (args) => ({
    components: { Layout, Sidebar, Content },
    setup() {
      return { args };
    },
    template: `
      <Layout v-bind="args">
        <template #sidebar>
          <Sidebar :items="args.sidebarItems" />
        </template>
        <template #default>
          <Content />
        </template>
      </Layout>
    `,
  }),
  parameters: {
    layout: "fullscreen",
  },
};
```

### Компоненты, управляемые данными

```typescript
const mockData = [
  { id: 1, name: "Элемент 1" },
  { id: 2, name: "Элемент 2" },
  { id: 3, name: "Элемент 3" },
];

export const WithData: Story = {
  args: {
    items: mockData,
  },
};

export const Empty: Story = {
  args: {
    items: [],
    emptyMessage: "Элементы не найдены",
  },
};
```

### Адаптивные компоненты

```typescript
export const Mobile: Story = {
  args: {
    variant: "mobile",
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
};

export const Desktop: Story = {
  args: {
    variant: "desktop",
  },
  parameters: {
    viewport: {
      defaultViewport: "desktop",
    },
  },
};
```

## Антипаттерны

### ❌ Не используйте привязку шаблонов (CSF2)

```typescript
// Плохо - Старый формат CSF2
const Template = (args) => ({
  components: { Button },
  setup() {
    return { args };
  },
  template: '<Button v-bind="args" />',
});
export const Primary = Template.bind({});
Primary.args = { label: "Button" };
```

```typescript
// Хорошо - формат CSF3
export const Primary: Story = {
  args: { label: "Button" },
};
```

### ❌ Не смешивайте сложную логику в историях

```typescript
// Плохо
export const Complex: Story = {
  render: (args) => ({
    components: { Component },
    setup() {
      const state = ref(false);
      onMounted(() => {
        // Сложные побочные эффекты
      });
      return { args, state };
    },
    template: '<Component v-bind="args" :isActive="state" />',
  }),
};
```

```typescript
// Хорошо - Переместите логику в компонент или используйте play-функции
export const Complex: Story = {
  args: { initialState: false },
};
```

### ❌ Не хардкодьте повторяющиеся пропсы

```typescript
// Плохо
export const Story1: Story = {
  args: { label: "Button", size: "medium", theme: "light" },
};
export const Story2: Story = {
  args: { label: "Submit", size: "medium", theme: "light" },
};
```

```typescript
// Хорошо - Используйте значения по умолчанию на уровне meta
const meta = {
  component: Button,
  args: {
    size: "medium",
    theme: "light",
  },
} satisfies Meta<typeof Button>;

export const Story1: Story = {
  args: { label: "Button" },
};
export const Story2: Story = {
  args: { label: "Submit" },
};
```

### ❌ Не пропускайте типы историй

```typescript
// Плохо - Отсутствует аннотация типа
export const Primary = {
  args: { label: "Button" },
};
```

```typescript
// Хорошо - С типом
export const Primary: Story = {
  args: { label: "Button" },
};
```
