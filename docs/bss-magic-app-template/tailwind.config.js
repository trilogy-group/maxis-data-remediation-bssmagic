/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography';
import tailwindcssAnimate from 'tailwindcss-animate';

export default {
    darkMode: ['class'],
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
  	extend: {
  		colors: {
  			primary: {
  				DEFAULT: 'rgb(128, 45, 200)',
  				'50': 'rgb(245, 235, 255)',
  				'100': 'rgb(235, 215, 255)',
  				'200': 'rgb(215, 185, 255)',
  				'300': 'rgb(195, 155, 255)',
  				'400': 'rgb(175, 125, 245)',
  				'500': 'rgb(155, 95, 235)',
  				'600': 'rgb(135, 65, 225)',
  				'700': 'rgb(128, 45, 200)',
  				'800': 'rgb(110, 35, 175)',
  				'900': 'rgb(90, 25, 150)',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			navigation: {
  				DEFAULT: 'rgb(0, 29, 61)',
  				'50': 'rgb(230, 240, 255)',
  				'100': 'rgb(200, 220, 245)',
  				'200': 'rgb(150, 180, 220)',
  				'300': 'rgb(100, 140, 195)',
  				'400': 'rgb(75, 110, 170)',
  				'500': 'rgb(50, 80, 145)',
  				'600': 'rgb(30, 60, 120)',
  				'700': 'rgb(15, 45, 95)',
  				'800': 'rgb(5, 35, 75)',
  				'900': 'rgb(0, 29, 61)'
  			},
  			secondary: {
  				DEFAULT: 'rgb(255, 79, 88)',
  				'50': 'rgb(255, 240, 240)',
  				'100': 'rgb(255, 225, 225)',
  				'200': 'rgb(255, 200, 200)',
  				'300': 'rgb(255, 160, 165)',
  				'400': 'rgb(255, 120, 130)',
  				'500': 'rgb(255, 100, 110)',
  				'600': 'rgb(255, 79, 88)',
  				'700': 'rgb(235, 60, 70)',
  				'800': 'rgb(215, 40, 50)',
  				'900': 'rgb(195, 20, 30)',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			success: {
  				DEFAULT: 'rgb(0, 200, 83)',
  				'50': 'rgb(240, 255, 245)',
  				'100': 'rgb(220, 252, 231)',
  				'200': 'rgb(187, 247, 208)',
  				'300': 'rgb(134, 239, 172)',
  				'400': 'rgb(74, 222, 128)',
  				'500': 'rgb(34, 197, 94)',
  				'600': 'rgb(22, 163, 74)',
  				'700': 'rgb(21, 128, 61)',
  				'800': 'rgb(22, 101, 52)',
  				'900': 'rgb(0, 100, 40)'
  			},
  			warning: {
  				DEFAULT: 'rgb(255, 187, 0)',
  				'50': 'rgb(255, 250, 230)',
  				'100': 'rgb(254, 243, 199)',
  				'200': 'rgb(253, 230, 138)',
  				'300': 'rgb(252, 211, 77)',
  				'400': 'rgb(251, 191, 36)',
  				'500': 'rgb(245, 158, 11)',
  				'600': 'rgb(217, 119, 6)',
  				'700': 'rgb(180, 83, 9)',
  				'800': 'rgb(146, 64, 14)',
  				'900': 'rgb(190, 140, 0)'
  			},
  			error: {
  				DEFAULT: 'rgb(255, 79, 88)',
  				'50': 'rgb(255, 240, 240)',
  				'100': 'rgb(254, 226, 226)',
  				'200': 'rgb(254, 202, 202)',
  				'300': 'rgb(252, 165, 165)',
  				'400': 'rgb(248, 113, 113)',
  				'500': 'rgb(239, 68, 68)',
  				'600': 'rgb(220, 38, 38)',
  				'700': 'rgb(185, 28, 28)',
  				'800': 'rgb(153, 27, 27)',
  				'900': 'rgb(195, 20, 30)'
  			},
  			neutral: {
  				'50': 'rgb(250, 250, 250)',
  				'100': 'rgb(245, 245, 245)',
  				'200': 'rgb(230, 230, 230)',
  				'300': 'rgb(210, 210, 210)',
  				'400': 'rgb(180, 180, 180)',
  				'500': 'rgb(150, 150, 150)',
  				'600': 'rgb(120, 120, 120)',
  				'700': 'rgb(90, 90, 90)',
  				'800': 'rgb(60, 60, 60)',
  				'900': 'rgb(30, 30, 30)'
  			},
  			background: {
  				DEFAULT: 'rgb(250, 250, 250)',
  				paper: 'rgb(255, 255, 255)',
  				elevated: 'rgb(255, 255, 255)'
  			},
  			text: {
  				primary: 'rgb(30, 30, 30)',
  				secondary: 'rgb(90, 90, 90)',
  				tertiary: 'rgb(120, 120, 120)',
  				disabled: 'rgb(180, 180, 180)'
  			},
  			border: {
  				DEFAULT: 'rgb(230, 230, 230)',
  				strong: 'rgb(210, 210, 210)',
  				interactive: 'rgb(128, 45, 200)'
  			},
  			interactive: {
  				primary: 'rgb(128, 45, 200)',
  				secondary: 'rgb(0, 29, 61)',
  				accent: 'rgb(255, 79, 88)',
  				muted: 'rgb(245, 245, 245)'
  			},
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		fontFamily: {
  			sans: [
  				'Inter',
  				'system-ui',
  				'sans-serif'
  			]
  		},
  		spacing: {
  			'1': '0.25rem',
  			'2': '0.5rem',
  			'3': '0.75rem',
  			'4': '1rem',
  			'5': '1.25rem',
  			'6': '1.5rem',
  			'8': '2rem',
  			'10': '2.5rem',
  			'12': '3rem',
  			'16': '4rem',
  			'20': '5rem',
  			'24': '6rem',
  			'32': '8rem',
  			'0.5': '0.125rem'
  		},
  		boxShadow: {
  			sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  			DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  			md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  			lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  			xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  			'2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
  		},
  		animation: {
  			'fade-in': 'fadeIn 0.3s ease-in-out',
  			'slide-in': 'slideIn 0.3s ease-in-out',
  			'pulse-slow': 'pulse 3s infinite',
  			'shine': 'shine var(--duration) infinite linear'
  		},
  		keyframes: {
  			fadeIn: {
  				'0%': {
  					opacity: '0'
  				},
  				'100%': {
  					opacity: '1'
  				}
  			},
  			slideIn: {
  				'0%': {
  					transform: 'translateY(10px)',
  					opacity: '0'
  				},
  				'100%': {
  					transform: 'translateY(0)',
  					opacity: '1'
  				}
  			},
  			shine: {
  				'0%': {
  					'background-position': '0% 0%'
  				},
  				'50%': {
  					'background-position': '100% 100%'
  				},
  				'100%': {
  					'background-position': '0% 0%'
  				}
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [typography, tailwindcssAnimate],
};