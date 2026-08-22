export interface Section {
  page: string;
  pageTitle: string;
  anchor: string;
  href: string;
  eyebrow: string;
  heading: string;
  text: string;
}

export interface RateLimit {
  max: number;
  windowMs: number;
}
