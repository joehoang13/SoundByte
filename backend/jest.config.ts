import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: { '^.+\.(ts|tsx)$': ['ts-jest', {}] },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testMatch: ['**/?(*.)+(test|tests|spec).ts'],
  testTimeout: 30000,
};

export default config;
