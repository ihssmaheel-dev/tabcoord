import { createSharedStore } from 'tabcoord';

export interface FormState {
  name: string;
  email: string;
  message: string;
}

export const formStore = createSharedStore<FormState>({
  name: 'distributed-form',
  initial: { name: '', email: '', message: '' },
  mergeStrategy: 'field',
});
