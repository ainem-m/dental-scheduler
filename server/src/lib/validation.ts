/**
 * Comprehensive validation system
 */

import type { Request, Response, NextFunction } from 'express';
import type { ValidationResult, ValidationError as ValidationErrorType } from '@shared/types';
import { ValidationError, createValidationError } from './errors';

// Validation rule types
export interface ValidationRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any, data: any) => string | null;
  sanitize?: (value: any) => any;
}

export interface ValidationSchema {
  body?: ValidationRule[];
  query?: ValidationRule[];
  params?: ValidationRule[];
}

// Validation engine
export class Validator {
  private rules: ValidationRule[] = [];

  constructor(rules: ValidationRule[] = []) {
    this.rules = rules;
  }

  validate(data: any): ValidationResult {
    const errors: ValidationErrorType[] = [];

    for (const rule of this.rules) {
      const value = this.getNestedValue(data, rule.field);
      const error = this.validateField(rule, value, data);
      
      if (error) {
        errors.push(error);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private validateField(rule: ValidationRule, value: any, data: any): ValidationErrorType | null {
    // Check required
    if (rule.required && (value === undefined || value === null || value === '')) {
      return {
        field: rule.field,
        message: `${rule.field} is required`,
        code: 'REQUIRED',
        value
      };
    }

    // Skip validation if value is empty and not required
    if (value === undefined || value === null || value === '') {
      return null;
    }

    // Type validation
    if (rule.type && !this.validateType(value, rule.type)) {
      return {
        field: rule.field,
        message: `${rule.field} must be of type ${rule.type}`,
        code: 'INVALID_TYPE',
        value
      };
    }

    // String validations
    if (rule.type === 'string' && typeof value === 'string') {
      if (rule.minLength && value.length < rule.minLength) {
        return {
          field: rule.field,
          message: `${rule.field} must be at least ${rule.minLength} characters long`,
          code: 'MIN_LENGTH',
          value
        };
      }

      if (rule.maxLength && value.length > rule.maxLength) {
        return {
          field: rule.field,
          message: `${rule.field} must be no more than ${rule.maxLength} characters long`,
          code: 'MAX_LENGTH',
          value
        };
      }

      if (rule.pattern && !rule.pattern.test(value)) {
        return {
          field: rule.field,
          message: `${rule.field} format is invalid`,
          code: 'INVALID_FORMAT',
          value
        };
      }
    }

    // Number validations
    if (rule.type === 'number' && typeof value === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        return {
          field: rule.field,
          message: `${rule.field} must be at least ${rule.min}`,
          code: 'MIN_VALUE',
          value
        };
      }

      if (rule.max !== undefined && value > rule.max) {
        return {
          field: rule.field,
          message: `${rule.field} must be no more than ${rule.max}`,
          code: 'MAX_VALUE',
          value
        };
      }
    }

    // Custom validation
    if (rule.custom) {
      const customError = rule.custom(value, data);
      if (customError) {
        return {
          field: rule.field,
          message: customError,
          code: 'CUSTOM_VALIDATION',
          value
        };
      }
    }

    return null;
  }

  private validateType(value: any, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'date':
        return value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)));
      default:
        return true;
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  sanitize(data: any): any {
    const sanitized = { ...data };

    for (const rule of this.rules) {
      if (rule.sanitize) {
        const value = this.getNestedValue(sanitized, rule.field);
        if (value !== undefined) {
          this.setNestedValue(sanitized, rule.field, rule.sanitize(value));
        }
      }
    }

    return sanitized;
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }
}

// Validation middleware factory
export const validateRequest = (schema: ValidationSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: ValidationErrorType[] = [];

    // Validate body
    if (schema.body) {
      const validator = new Validator(schema.body);
      const result = validator.validate(req.body);
      errors.push(...result.errors);
      
      // Sanitize body
      if (result.isValid) {
        req.body = validator.sanitize(req.body);
      }
    }

    // Validate query
    if (schema.query) {
      const validator = new Validator(schema.query);
      const result = validator.validate(req.query);
      errors.push(...result.errors);
      
      // Sanitize query
      if (result.isValid) {
        req.query = validator.sanitize(req.query);
      }
    }

    // Validate params
    if (schema.params) {
      const validator = new Validator(schema.params);
      const result = validator.validate(req.params);
      errors.push(...result.errors);
      
      // Sanitize params
      if (result.isValid) {
        req.params = validator.sanitize(req.params);
      }
    }

    if (errors.length > 0) {
      throw new ValidationError('Validation failed', 'validation', errors);
    }

    next();
  };
};

// Common validation rules
export const CommonValidations = {
  id: (): ValidationRule => ({
    field: 'id',
    required: true,
    type: 'number',
    min: 1,
    sanitize: (value: any) => parseInt(value, 10)
  }),

  date: (field: string = 'date'): ValidationRule => ({
    field,
    required: true,
    type: 'string',
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    custom: (value: string) => {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        return 'Invalid date format';
      }
      return null;
    }
  }),

  timeMinutes: (field: string = 'time_min'): ValidationRule => ({
    field,
    required: true,
    type: 'number',
    min: 0,
    max: 1440, // 24 hours in minutes
    custom: (value: number) => {
      if (value % 5 !== 0) {
        return 'Time must be in 5-minute intervals';
      }
      return null;
    }
  }),

  columnIndex: (field: string = 'column_index', maxColumns: number = 10): ValidationRule => ({
    field,
    required: true,
    type: 'number',
    min: 0,
    max: maxColumns - 1
  }),

  patientName: (field: string = 'patient_name'): ValidationRule => ({
    field,
    required: false,
    type: 'string',
    minLength: 1,
    maxLength: 100,
    sanitize: (value: string) => value?.trim()
  }),

  handwritingFilename: (field: string = 'handwriting'): ValidationRule => ({
    field,
    required: false,
    type: 'string',
    pattern: /^[a-f0-9-]+\.png$/,
    custom: (value: string) => {
      if (value && !value.endsWith('.png')) {
        return 'Handwriting filename must be a PNG file';
      }
      return null;
    }
  }),

  username: (field: string = 'username'): ValidationRule => ({
    field,
    required: true,
    type: 'string',
    minLength: 3,
    maxLength: 50,
    pattern: /^[a-zA-Z0-9_]+$/,
    sanitize: (value: string) => value?.trim().toLowerCase()
  }),

  password: (field: string = 'password'): ValidationRule => ({
    field,
    required: true,
    type: 'string',
    minLength: 8,
    maxLength: 128,
    custom: (value: string) => {
      if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
        return 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
      }
      return null;
    }
  }),

  role: (field: string = 'role'): ValidationRule => ({
    field,
    required: true,
    type: 'string',
    custom: (value: string) => {
      if (!['admin', 'staff'].includes(value)) {
        return 'Role must be either "admin" or "staff"';
      }
      return null;
    }
  }),

  email: (field: string = 'email'): ValidationRule => ({
    field,
    required: false,
    type: 'string',
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    sanitize: (value: string) => value?.trim().toLowerCase()
  }),

  pagination: {
    page: (): ValidationRule => ({
      field: 'page',
      required: false,
      type: 'number',
      min: 1,
      sanitize: (value: any) => parseInt(value, 10) || 1
    }),

    limit: (): ValidationRule => ({
      field: 'limit',
      required: false,
      type: 'number',
      min: 1,
      max: 100,
      sanitize: (value: any) => parseInt(value, 10) || 10
    })
  }
};

// Validation schemas for common endpoints
export const ValidationSchemas = {
  createReservation: {
    body: [
      CommonValidations.date(),
      CommonValidations.timeMinutes(),
      CommonValidations.columnIndex(),
      CommonValidations.patientName(),
      CommonValidations.handwritingFilename(),
      {
        field: 'reservation',
        required: false,
        type: 'object' as const,
        custom: (value: any, data: any) => {
          if (!data.patient_name && !data.handwriting) {
            return 'Either patient_name or handwriting must be provided';
          }
          return null;
        }
      }
    ]
  },

  updateReservation: {
    params: [CommonValidations.id()],
    body: [
      CommonValidations.date(),
      CommonValidations.timeMinutes(),
      CommonValidations.columnIndex(),
      CommonValidations.patientName(),
      CommonValidations.handwritingFilename()
    ]
  },

  deleteReservation: {
    params: [CommonValidations.id()]
  },

  getReservations: {
    query: [
      {
        field: 'date',
        required: false,
        type: 'string' as const,
        pattern: /^\d{4}-\d{2}-\d{2}$/
      },
      {
        field: 'startDate',
        required: false,
        type: 'string' as const,
        pattern: /^\d{4}-\d{2}-\d{2}$/
      },
      {
        field: 'endDate',
        required: false,
        type: 'string' as const,
        pattern: /^\d{4}-\d{2}-\d{2}$/
      },
      CommonValidations.columnIndex('columnIndex', 10),
      CommonValidations.pagination.page(),
      CommonValidations.pagination.limit()
    ]
  },

  createUser: {
    body: [
      CommonValidations.username(),
      CommonValidations.password(),
      CommonValidations.role()
    ]
  },

  updateUser: {
    params: [CommonValidations.id()],
    body: [
      CommonValidations.username(),
      CommonValidations.role()
    ]
  }
};

// File upload validation
export const validateFileUpload = (
  allowedTypes: string[] = ['image/png'],
  maxSize: number = 5 * 1024 * 1024 // 5MB
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }

    const { mimetype, size } = req.file;

    if (!allowedTypes.includes(mimetype)) {
      throw new ValidationError(
        `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
        'file',
        mimetype
      );
    }

    if (size > maxSize) {
      throw new ValidationError(
        `File too large. Maximum size: ${maxSize / (1024 * 1024)}MB`,
        'file',
        size
      );
    }

    next();
  };
};