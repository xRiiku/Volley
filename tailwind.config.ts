import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        corp: 'var(--cl_corp)',
        corpHover: 'var(--cl_corp_hover)',
        corp2: 'var(--cl_corp2)',
        corp2Hover: 'var(--cl_corp2_hover)',
        title: 'var(--cl_title)',
        subtitle: 'var(--cl_subtitle)',
        text: 'var(--cl_text)',
        textLight: 'var(--cl_text_light)',
        border: 'var(--cl_border)',
        body: 'var(--cl_background_body)',
        whiteBg: 'var(--cl_background_white)',
        darkBg: 'var(--cl_background_dark)',
        grayBg: 'var(--cl_background_gray)',
      },
      borderRadius: {
        '5': 'var(--border-radius-5)',
        '10': 'var(--border-radius-10)',
        '15': 'var(--border-radius-15)',
        '20': 'var(--border-radius-20)',
        '25': 'var(--border-radius-25)',
        '30': 'var(--border-radius-30)',
        '50': 'var(--border-radius-50)',
        'full-var': 'var(--border-radius-full)',
      },
      fontFamily: {
        page: 'var(--font-page)',
        titles: 'var(--font-titles)',
        subtitles: 'var(--font-subtitles)',
        pretitles: 'var(--font-pretitles)',
        text: 'var(--font-text)',
      },
      fontSize: {
        '10': 'var(--font-size-10)',
        '12': 'var(--font-size-12)',
        '14': 'var(--font-size-14)',
        '16': 'var(--font-size-16)',
        '18': 'var(--font-size-18)',
        '20': 'var(--font-size-20)',
        '24': 'var(--font-size-24)',
        '32': 'var(--font-size-32)',
        '36': 'var(--font-size-36)',
      },
    },
  },
  plugins: [],
} satisfies Config;
