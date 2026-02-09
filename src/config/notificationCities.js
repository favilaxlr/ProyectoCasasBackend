export const MAX_NOTIFICATION_CITIES = 3;
export const MIN_NOTIFICATION_CITIES = 1;
export const USER_NOTIFICATION_CITY_COOLDOWN_DAYS = 7;
export const USER_NOTIFICATION_CITY_COOLDOWN_MS = USER_NOTIFICATION_CITY_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

export const NOTIFICATION_CITIES = [
    { code: 'dallas-texas', city: 'Dallas', state: 'Texas', label: 'Dallas, Texas' },
    { code: 'houston-texas', city: 'Houston', state: 'Texas', label: 'Houston, Texas' },
    { code: 'austin-texas', city: 'Austin', state: 'Texas', label: 'Austin, Texas' },
    { code: 'san-antonio-texas', city: 'San Antonio', state: 'Texas', label: 'San Antonio, Texas' },
    { code: 'phoenix-arizona', city: 'Phoenix', state: 'Arizona', label: 'Phoenix, Arizona' },
    { code: 'atlanta-georgia', city: 'Atlanta', state: 'Georgia', label: 'Atlanta, Georgia' },
    { code: 'miami-florida', city: 'Miami', state: 'Florida', label: 'Miami, Florida' },
    { code: 'orlando-florida', city: 'Orlando', state: 'Florida', label: 'Orlando, Florida' },
    { code: 'new-york-new-york', city: 'New York', state: 'New York', label: 'New York, New York' },
    { code: 'los-angeles-california', city: 'Los Angeles', state: 'California', label: 'Los Angeles, California' },
    { code: 'chicago-illinois', city: 'Chicago', state: 'Illinois', label: 'Chicago, Illinois' },
    { code: 'san-diego-california', city: 'San Diego', state: 'California', label: 'San Diego, California' },
    { code: 'san-jose-california', city: 'San Jose', state: 'California', label: 'San Jose, California' },
    { code: 'las-vegas-nevada', city: 'Las Vegas', state: 'Nevada', label: 'Las Vegas, Nevada' },
    { code: 'denver-colorado', city: 'Denver', state: 'Colorado', label: 'Denver, Colorado' },
    { code: 'seattle-washington', city: 'Seattle', state: 'Washington', label: 'Seattle, Washington' },
    { code: 'boston-massachusetts', city: 'Boston', state: 'Massachusetts', label: 'Boston, Massachusetts' },
    { code: 'washington-district-of-columbia', city: 'Washington', state: 'District of Columbia', label: 'Washington, DC' },
    { code: 'charlotte-north-carolina', city: 'Charlotte', state: 'North Carolina', label: 'Charlotte, North Carolina' },
    { code: 'nashville-tennessee', city: 'Nashville', state: 'Tennessee', label: 'Nashville, Tennessee' },
    { code: 'tampa-florida', city: 'Tampa', state: 'Florida', label: 'Tampa, Florida' },
    { code: 'jacksonville-florida', city: 'Jacksonville', state: 'Florida', label: 'Jacksonville, Florida' },
    { code: 'philadelphia-pennsylvania', city: 'Philadelphia', state: 'Pennsylvania', label: 'Philadelphia, Pennsylvania' },
    { code: 'minneapolis-minnesota', city: 'Minneapolis', state: 'Minnesota', label: 'Minneapolis, Minnesota' }
];

const slugify = (value = '') => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

export const normalizeCityCode = (city = '', state = '') => {
    const citySlug = slugify(city);
    const stateSlug = slugify(state);
    if (!citySlug && !stateSlug) return null;
    if (!stateSlug) return citySlug;
    return `${citySlug}-${stateSlug}`;
};

export const getCityOptionByCode = (code) => {
    const normalized = code?.toLowerCase();
    return NOTIFICATION_CITIES.find(city => city.code === normalized) || null;
};

export const isValidCityCode = (code) => Boolean(getCityOptionByCode(code));

export const getCityLabel = (code) => getCityOptionByCode(code)?.label || null;

export const sanitizeCityCodes = (codes = []) => {
    const unique = Array.from(new Set((codes || []).filter(Boolean)));
    return unique.filter(isValidCityCode).slice(0, MAX_NOTIFICATION_CITIES);
};

export const buildCityLabel = (city, state) => {
    const trimmedCity = city?.trim();
    const trimmedState = state?.trim();
    if (trimmedCity && trimmedState) return `${trimmedCity}, ${trimmedState}`;
    return trimmedCity || null;
};

export const buildCityCodeFromAddress = (address = {}) => {
    if (!address) return null;
    return normalizeCityCode(address.city, address.state);
};

export const DEFAULT_NOTIFICATION_CITY = NOTIFICATION_CITIES[0].code;
