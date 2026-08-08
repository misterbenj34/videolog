import { describe, it, expect } from 'vitest';
import { TRANSLATIONS, ALL_QUESTIONS } from '../src/js/packs.js';

describe('Translations & Questions', () => {
    const requiredLangs = ['en', 'fr', 'es', 'de', 'it'];

    it('should have translations for all required languages', () => {
        for (const reqLang of requiredLangs) {
            expect(TRANSLATIONS).toHaveProperty(reqLang);
            expect(Object.keys(TRANSLATIONS[reqLang]).length).toBeGreaterThan(0);
        }
    });

    it('should have valid structure for all questions', () => {
        expect(Array.isArray(ALL_QUESTIONS)).toBe(true);
        for (const question of ALL_QUESTIONS) {
            expect(question).toHaveProperty('id');
            expect(question).toHaveProperty('category');
            expect(question).toHaveProperty('text');
            
            for (const reqLang of requiredLangs) {
                expect(question.category).toHaveProperty(reqLang);
                expect(question.text).toHaveProperty(reqLang);
            }
        }
    });
});

