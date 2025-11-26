const s = getComputedStyle(document.documentElement);

export const palette = {
  base0: s.getPropertyValue('--base0-color').trim(),
  base1: s.getPropertyValue('--base1-color').trim(),
  base2: s.getPropertyValue('--base2-color').trim(),
  rose: s.getPropertyValue('--rose-color').trim(),
  branRed: s.getPropertyValue('--bran-red-color').trim(),
  grey: s.getPropertyValue('--grey-color').trim(),
  red: s.getPropertyValue('--red-color').trim(),
}
