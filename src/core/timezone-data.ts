import ct from 'countries-and-timezones'
import type { Country, Timezone, CountryCode, TimezoneName, Options } from 'countries-and-timezones'

export type { Country, Timezone, CountryCode, TimezoneName, Options }

export function getTimezonesForCountry(countryId: string, opts?: Options): Timezone[] | null {
  return ct.getTimezonesForCountry(countryId, opts) as Timezone[] | null
}

export function getCountriesForTimezone(tzName: string, opts?: Options): Country[] {
  return ct.getCountriesForTimezone(tzName, opts) as Country[]
}

export function getCountry(code: string, opts?: Options): Country | null {
  return ct.getCountry(code, opts) as Country | null
}

export function getTimezone(name: string): Timezone | null {
  return ct.getTimezone(name) as Timezone | null
}

export function getAllTimezones(opts?: Options): Record<string, Timezone> {
  return ct.getAllTimezones(opts) as Record<string, Timezone>
}

export function getAllCountries(opts?: Options): Record<string, Country> {
  return ct.getAllCountries(opts) as Record<string, Country>
}
