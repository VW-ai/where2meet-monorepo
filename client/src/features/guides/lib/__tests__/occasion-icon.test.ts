import { Briefcase, MapPin, PartyPopper } from 'lucide';
import { describe, expect, it } from 'vitest';
import { occasionIcon } from '../occasion-icon';

describe('occasionIcon', () => {
  it('draws the blog’s icon for a homepage occasion and its own for a guides-only one', () => {
    expect([occasionIcon('team-meeting'), occasionIcon('team-welcome')]).toEqual([
      Briefcase,
      PartyPopper,
    ]);
  });

  it('draws a pin for an occasion added in the panel, even one named like an object property', () => {
    expect([occasionIcon('brunch'), occasionIcon('constructor')]).toEqual([MapPin, MapPin]);
  });
});
