import { MoverError } from '@/services/MoverError';

export enum ContentName {
  TxInfo = 'txInfo'
}

export class SameContentError extends MoverError {
  constructor(protected readonly contentType: ContentName) {
    super(`Content "${contentType}" is the same`);
  }

  public getContentName(): ContentName {
    return this.contentType;
  }
}
