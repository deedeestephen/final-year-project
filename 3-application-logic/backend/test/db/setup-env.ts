import { loadTestEnv } from './test-env';

// Runs in each test worker so every client points at the *_test databases.
loadTestEnv();
