tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    colors: {
                        indigo: { 50:'rgb(var(--i50) / <alpha-value>)', 100:'rgb(var(--i100) / <alpha-value>)', 200:'rgb(var(--i200) / <alpha-value>)', 300:'rgb(var(--i300) / <alpha-value>)', 400:'rgb(var(--i400) / <alpha-value>)', 500:'rgb(var(--i500) / <alpha-value>)', 600:'rgb(var(--i600) / <alpha-value>)', 700:'rgb(var(--i700) / <alpha-value>)', 800:'rgb(var(--i800) / <alpha-value>)', 900:'rgb(var(--i900) / <alpha-value>)', 950:'rgb(var(--i950) / <alpha-value>)' },
                        purple: { 50:'rgb(var(--p50) / <alpha-value>)', 100:'rgb(var(--p100) / <alpha-value>)', 200:'rgb(var(--p200) / <alpha-value>)', 300:'rgb(var(--p300) / <alpha-value>)', 400:'rgb(var(--p400) / <alpha-value>)', 500:'rgb(var(--p500) / <alpha-value>)', 600:'rgb(var(--p600) / <alpha-value>)', 700:'rgb(var(--p700) / <alpha-value>)', 800:'rgb(var(--p800) / <alpha-value>)', 900:'rgb(var(--p900) / <alpha-value>)', 950:'rgb(var(--p950) / <alpha-value>)' },
                        slate:  { 50:'#f5f8fc',100:'#ebf0f7',200:'#d9e2ee',300:'#bccade',400:'#8a99b0',500:'#62728b',600:'#48586f',700:'#324158',800:'#1b273b',900:'#101a2c',950:'#08101e' }
                    },
                    fontFamily: { sans: ['"Plus Jakarta Sans"', 'sans-serif'] },
                    animation: {
                        'spin-slow': 'spin 3s linear infinite',
                        'bounce-short': 'bounce 0.5s ease-in-out 2',
                        'slide-up': 'slideUp 0.4s ease-out forwards',
                        'toast-in': 'toastIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
                        'toast-out': 'toastOut 0.3s ease-in forwards',
                        'bounce-subtle': 'bounceSubtle 2s infinite'
                    },
                    keyframes: {
                        slideUp: { '0%': { opacity: '0', transform: 'translateY(15px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
                        toastIn: { '0%': { opacity: '0', transform: 'translateY(100%) scale(0.9)' }, '100%': { opacity: '1', transform: 'translateY(0) scale(1)' } },
                        toastOut: { '0%': { opacity: '1', transform: 'translateY(0) scale(1)' }, '100%': { opacity: '0', transform: 'translateY(20px) scale(0.95)' } },
                        bounceSubtle: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-5px)' } }
                    }
                }
            }
        }
