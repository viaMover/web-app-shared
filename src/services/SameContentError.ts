import { MoverError } from './MoverError';

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
