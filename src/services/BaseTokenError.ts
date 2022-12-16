import { Network } from '../references/network';
import { MoverError } from './MoverError';

export class BaseTokenError extends MoverError {
  constructor(protected readonly tokenAddress: string, protected readonly network: Network) {
    super(`Token ${tokenAddress} is base for network: ${network}`);
  }
}
