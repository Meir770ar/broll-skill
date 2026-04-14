// Font loader — register your Hebrew fonts here
// Drop font files into public/fonts/ and update the paths below if you change fonts.
//
// Default (free): Assistant from Google Fonts — https://fonts.google.com/specimen/Assistant
// Other free alternatives: Heebo, Rubik (Google Fonts).
// Premium: if you licensed a professional Hebrew font, place it in public/fonts/
//          and update both the family name here and in config.json -> font_family.
import {staticFile} from 'remotion';

const loadFont = (family, src, weight = 'normal') => {
  if (typeof document === 'undefined') return;
  const id = `font-${family}-${weight}`;
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
    @font-face {
      font-family: "${family}";
      src: url("${src}");
      font-weight: ${weight};
      font-style: normal;
      font-display: block;
    }
  `;
  document.head.appendChild(style);
};

// EDIT THIS if you change fonts — filenames must match what you put in public/fonts/
export const loadAllFonts = () => {
  loadFont('Assistant', staticFile('fonts/Assistant-Regular.ttf'), 400);
  loadFont('Assistant', staticFile('fonts/Assistant-Bold.ttf'), 700);
};

loadAllFonts();
