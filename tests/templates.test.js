import { describe, it, expect } from 'vitest';
const { shouldShowCostCenterLine, buildSubjectByType } = require('../js/templates.js');

describe('shouldShowCostCenterLine', () => {
  it('returns true for custody type', () => {
    expect(shouldShowCostCenterLine({ type: 'custody' })).toBe(true);
  });

  it('returns true for close_custody type', () => {
    expect(shouldShowCostCenterLine({ type: 'close_custody' })).toBe(true);
  });

  it('returns false for general without cost center enabled', () => {
    expect(shouldShowCostCenterLine({ type: 'general' })).toBe(false);
  });

  it('returns false for general with cost center enabled but no data', () => {
    expect(shouldShowCostCenterLine({
      type: 'general',
      financialIncludeCostCenter: true,
      costCenter: '',
      programNameAr: '',
      projectName: ''
    })).toBe(false);
  });

  it('returns true for general with cost center enabled and data', () => {
    expect(shouldShowCostCenterLine({
      type: 'general',
      financialIncludeCostCenter: true,
      costCenter: 'TAS-MFA'
    })).toBe(true);
  });

  it('returns true for general_financial with cost center and program', () => {
    expect(shouldShowCostCenterLine({
      type: 'general_financial',
      financialIncludeCostCenter: true,
      programNameAr: 'معرفة'
    })).toBe(true);
  });

  it('returns false for general_financial without cost center flag', () => {
    expect(shouldShowCostCenterLine({
      type: 'general_financial',
      financialIncludeCostCenter: false,
      costCenter: 'TAS-MFA'
    })).toBe(false);
  });
});

describe('buildSubjectByType', () => {
  it('returns custody subject', () => {
    expect(buildSubjectByType('custody')).toBe('طلب عهدة مالية');
  });

  it('returns close custody subject', () => {
    expect(buildSubjectByType('close_custody')).toBe('طلب إغلاق عهدة مالية');
  });

  it('returns general financial subject', () => {
    expect(buildSubjectByType('general_financial')).toBe('طلب مالي عام');
  });

  it('returns empty string for general type', () => {
    expect(buildSubjectByType('general')).toBe('');
  });

  it('returns empty string for unknown type', () => {
    expect(buildSubjectByType('unknown')).toBe('');
  });
});
