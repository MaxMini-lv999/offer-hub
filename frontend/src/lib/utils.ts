import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// tailwind.config.js 里自定义的字号。不登记的话 tailwind-merge 会把 text-meta 当成文字颜色，
// 和 text-muted-foreground 这类颜色类合并时只留后一个，字号或颜色就丢了
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["display", "title", "heading", "body", "meta"] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
