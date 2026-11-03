/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: ['"PingFang SC"', '"Hiragino Sans GB"', '"Noto Sans SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
  			// 标题和 VN 台词用思源宋体（自托管，按 unicode-range 分片加载）
  			title: ['"Noto Serif SC"', '"Songti SC"', '"STSong"', '"SimSun"', 'serif'],
  			mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
  		},
  		// 全站字号：首页封面大标题 / 页面标题 / 区块标题 / 正文 / 辅助信息；display 只给首页封面用
  		fontSize: {
  			display: ['40px', { lineHeight: '1.2' }],
  			title: ['28px', { lineHeight: '1.3' }],
  			heading: ['20px', { lineHeight: '1.4' }],
  			body: ['15px', { lineHeight: '1.7' }],
  			meta: ['13px', { lineHeight: '1.5' }]
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		transitionDuration: {
  			micro: '120ms',
  			panel: '240ms'
  		},
  		transitionTimingFunction: {
  			standard: 'cubic-bezier(0.2, 0, 0, 1)'
  		},
  		// 点赞动效（components/LikeContent.tsx）：只动 transform 和 opacity；系统减少动态效果时由 index.css 统一关掉
  		keyframes: {
  			// 点赞成功：图标从按下的大小弹过头再回来
  			'like-pop': {
  				'0%': { transform: 'scale(0.7)' },
  				'45%': { transform: 'scale(1.3)' },
  				'100%': { transform: 'scale(1)' }
  			},
  			// 取消点赞：图标往里收一下再回原位
  			'like-settle': {
  				'0%': { transform: 'scale(1)' },
  				'40%': { transform: 'scale(0.75)' },
  				'100%': { transform: 'scale(1)' }
  			},
  			// 点赞成功：图标外一圈方形墨线向外扩散并淡出
  			'like-ring': {
  				'0%': { transform: 'scale(0.9)', opacity: '0.5' },
  				'100%': { transform: 'scale(1.8)', opacity: '0' }
  			},
  			// +1 从图标上方浮现、继续上飘并淡出
  			'like-float-up': {
  				'0%': { transform: 'translateY(4px)', opacity: '0' },
  				'20%': { transform: 'translateY(0)', opacity: '1' },
  				'100%': { transform: 'translateY(-10px)', opacity: '0' }
  			},
  			// -1 浮现后往下沉回图标并淡出
  			'like-float-down': {
  				'0%': { transform: 'translateY(-4px)', opacity: '0' },
  				'20%': { transform: 'translateY(0)', opacity: '1' },
  				'100%': { transform: 'translateY(4px)', opacity: '0' }
  			},
  			// 点赞数变化：新数字从下（增加）或上（减少）滑进来
  			'like-count-up': {
  				'0%': { transform: 'translateY(45%)', opacity: '0' },
  				'100%': { transform: 'translateY(0)', opacity: '1' }
  			},
  			'like-count-down': {
  				'0%': { transform: 'translateY(-45%)', opacity: '0' },
  				'100%': { transform: 'translateY(0)', opacity: '1' }
  			}
  		},
  		animation: {
  			'like-pop': 'like-pop 420ms cubic-bezier(0.2, 0, 0, 1)',
  			'like-settle': 'like-settle 320ms cubic-bezier(0.2, 0, 0, 1)',
  			'like-ring': 'like-ring 520ms cubic-bezier(0.2, 0, 0, 1) forwards',
  			'like-float-up': 'like-float-up 800ms cubic-bezier(0.2, 0, 0, 1) forwards',
  			'like-float-down': 'like-float-down 640ms cubic-bezier(0.2, 0, 0, 1) forwards',
  			'like-count-up': 'like-count-up 240ms cubic-bezier(0.2, 0, 0, 1)',
  			'like-count-down': 'like-count-down 240ms cubic-bezier(0.2, 0, 0, 1)'
  		},
  		colors: {
  			background: 'oklch(var(--background) / <alpha-value>)',
  			foreground: 'oklch(var(--foreground) / <alpha-value>)',
  			card: {
  				DEFAULT: 'oklch(var(--card) / <alpha-value>)',
  				foreground: 'oklch(var(--card-foreground) / <alpha-value>)'
  			},
  			popover: {
  				DEFAULT: 'oklch(var(--popover) / <alpha-value>)',
  				foreground: 'oklch(var(--popover-foreground) / <alpha-value>)'
  			},
  			primary: {
  				DEFAULT: 'oklch(var(--primary) / <alpha-value>)',
  				foreground: 'oklch(var(--primary-foreground) / <alpha-value>)'
  			},
  			secondary: {
  				DEFAULT: 'oklch(var(--secondary) / <alpha-value>)',
  				foreground: 'oklch(var(--secondary-foreground) / <alpha-value>)'
  			},
  			muted: {
  				DEFAULT: 'oklch(var(--muted) / <alpha-value>)',
  				foreground: 'oklch(var(--muted-foreground) / <alpha-value>)'
  			},
  			accent: {
  				DEFAULT: 'oklch(var(--accent) / <alpha-value>)',
  				foreground: 'oklch(var(--accent-foreground) / <alpha-value>)'
  			},
  			destructive: 'oklch(var(--destructive) / <alpha-value>)',
  			border: 'oklch(var(--border) / <alpha-value>)',
  			input: 'oklch(var(--input) / <alpha-value>)',
  			ring: 'oklch(var(--ring) / <alpha-value>)',
  			// 樱红：品牌标识、VN 姓名牌、推进提示、掌握进度；按钮和交互强调仍用墨色
  			brand: {
  				DEFAULT: 'oklch(var(--brand) / <alpha-value>)',
  				soft: 'oklch(var(--brand-soft) / <alpha-value>)',
  				foreground: 'oklch(var(--brand-foreground) / <alpha-value>)'
  			},
  			// 天青：VN 选项高亮和系统提示
  			system: 'oklch(var(--system) / <alpha-value>)',
  			// 骨架屏色块，配合 index.css 里的 .skeleton 扫光
  			skeleton: 'oklch(var(--skeleton) / <alpha-value>)',
  			easy: 'oklch(var(--easy) / <alpha-value>)',
  			medium: 'oklch(var(--medium) / <alpha-value>)',
  			hard: 'oklch(var(--hard) / <alpha-value>)',
  			dialogue: {
  				DEFAULT: 'oklch(var(--dialogue) / <alpha-value>)',
  				foreground: 'oklch(var(--dialogue-foreground) / <alpha-value>)'
  			}
  		},
  		// 正文排版跟随主题 token，暗色下不用再写 prose-invert
  		typography: {
  			DEFAULT: {
  				css: {
  					'--tw-prose-body': 'oklch(var(--foreground))',
  					'--tw-prose-headings': 'oklch(var(--foreground))',
  					'--tw-prose-lead': 'oklch(var(--muted-foreground))',
  					'--tw-prose-links': 'oklch(var(--foreground))',
  					'--tw-prose-bold': 'oklch(var(--foreground))',
  					'--tw-prose-counters': 'oklch(var(--muted-foreground))',
  					'--tw-prose-bullets': 'oklch(var(--muted-foreground))',
  					'--tw-prose-hr': 'oklch(var(--border))',
  					'--tw-prose-quotes': 'oklch(var(--foreground))',
  					'--tw-prose-quote-borders': 'oklch(var(--foreground))',
  					'--tw-prose-captions': 'oklch(var(--muted-foreground))',
  					'--tw-prose-kbd': 'oklch(var(--foreground))',
  					'--tw-prose-code': 'oklch(var(--foreground))',
  					'--tw-prose-pre-code': 'oklch(var(--foreground))',
  					'--tw-prose-pre-bg': 'oklch(var(--muted))',
  					'--tw-prose-th-borders': 'oklch(var(--border))',
  					'--tw-prose-td-borders': 'oklch(var(--border))'
  				}
  			}
  		}
  	}
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
}
