import { MoverAPIError } from '@/services/api/mover/MoverAPIError';
import { MoverError } from '@/services/MoverError';

export class CountryNotSupportedError extends MoverError {
  protected readonly countryCode: string;
  protected readonly country: string;

  constructor(error: MoverAPIError) {
    const { country, countryName } = error.payload as {
      country: string;
      countryName: string;
    };
    super(`Country is not supported: ${country}`);
    this.countryCode = country;
    this.country = countryName;
  }

  public getCountryCode(): string {
    return this.countryCode;
  }

  public getCountry(): string {
    return this.country;
  }
}
