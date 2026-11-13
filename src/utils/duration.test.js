import { formatDurationInput } from './duration';

it.each([
  ['1', '1'],
  ['12', '12:'], // the colon appears after the minutes
  ['12:3', '12:3'],
  ['12:34', '12:34'],
  ['1234', '12:34'], // pasted without a colon
  ['12:345', '12:34'], // seconds stop at two digits
  ['12::', '12:'], // typing ':' after the automatic one doesn't double it
  ['5:30', '5:30'], // one-digit minutes, colon typed by hand
  ['5.30', '5:30'], // phone number pads: '.' types the ':'
  ['5 30', '5:30'],
  ['1:02:33', '1:02:33'], // hours
  ['ab12', '12:'], // letters are ignored
  [':12', '12:'], // no leading colon
  ['', ''],
])('formats %p as %p', (typed, expected) => {
  expect(formatDurationInput(typed)).toBe(expected);
});

it('lets backspace remove the automatic colon', () => {
  expect(formatDurationInput('12', { autoColon: false })).toBe('12');
});

it('puts the colon back as soon as the seconds are typed again', () => {
  expect(formatDurationInput('123')).toBe('12:3');
});
