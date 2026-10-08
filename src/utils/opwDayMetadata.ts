export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type DayVolatilityTier = 'safest' | 'safe' | 'abit_safe' | 'volatile';

export interface DayMetadata {
    id: DayOfWeek;
    name: string;
    volatilityTier: DayVolatilityTier;
    volatilityLabel: string;
    description: string;
}

export const DAY_METADATA: Record<DayOfWeek, DayMetadata> = {
    monday: {
        id: 'monday',
        name: 'Monday',
        volatilityTier: 'abit_safe',
        volatilityLabel: 'A bit safe',
        description: 'Lower match volume, disciplined favorite selection with balanced 1X draw hedges.'
    },
    tuesday: {
        id: 'tuesday',
        name: 'Tuesday',
        volatilityTier: 'volatile',
        volatilityLabel: 'Usually volatile',
        description: 'Midweek rotations, cup fixtures, elevated draw-trap frequency, sensitive underdog bonuses.'
    },
    wednesday: {
        id: 'wednesday',
        name: 'Wednesday',
        volatilityTier: 'safest',
        volatilityLabel: 'Safest',
        description: 'Elite European competition, premier lineups, high favorite conversion on attack/defense separation.'
    },
    thursday: {
        id: 'thursday',
        name: 'Thursday',
        volatilityTier: 'volatile',
        volatilityLabel: 'Usually volatile',
        description: 'Europa/Conference league fatigue, heavy squad rotation, active draw damping and upset protection.'
    },
    friday: {
        id: 'friday',
        name: 'Friday',
        volatilityTier: 'safe',
        volatilityLabel: 'Safe',
        description: 'Weekend openers, clean single-fixture form, reliable 1X hedging.'
    },
    saturday: {
        id: 'saturday',
        name: 'Saturday',
        volatilityTier: 'safest',
        volatilityLabel: 'Safest',
        description: 'Peak domestic league volume, prime data integrity, highest conviction favorite performance.'
    },
    sunday: {
        id: 'sunday',
        name: 'Sunday',
        volatilityTier: 'volatile',
        volatilityLabel: 'Usually volatile',
        description: 'High-fatigue weekend closers, derby encounters, dead-heat draw damping with inverted false-favorite traps.'
    }
};
