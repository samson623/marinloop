export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Enums: {
      dose_status: 'taken' | 'late' | 'missed' | 'skipped'
      notification_type: 'info' | 'warning' | 'success' | 'error'
      plan_type: 'free' | 'pro' | 'family'
    }
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          name: string | null
          avatar_url: string | null
          timezone: string
          plan: Database['public']['Enums']['plan_type']
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          name?: string | null
          avatar_url?: string | null
          timezone?: string
          plan?: Database['public']['Enums']['plan_type']
          created_at?: string
          updated_at?: string
        }
        Update: {
          email?: string
          name?: string | null
          avatar_url?: string | null
          timezone?: string
          plan?: Database['public']['Enums']['plan_type']
          updated_at?: string
        }
        Relationships: []
      }
      medications: {
        Row: {
          id: string
          user_id: string
          name: string
          dosage: string | null
          instructions: string | null
          warnings: string | null
          freq: number
          color: string
          icon: string | null
          barcode: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          name: string
          dosage?: string | null
          instructions?: string | null
          warnings?: string | null
          freq?: number
          color?: string
          icon?: string | null
          barcode?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          dosage?: string | null
          instructions?: string | null
          warnings?: string | null
          freq?: number
          color?: string
          icon?: string | null
          barcode?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      schedules: {
        Row: {
          id: string
          medication_id: string
          user_id: string
          time: string
          days: number[]
          food_context_minutes: number
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          medication_id: string
          user_id?: string
          time: string
          days?: number[]
          food_context_minutes?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          time?: string
          days?: number[]
          food_context_minutes?: number
          active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      dose_logs: {
        Row: {
          id: string
          user_id: string
          medication_id: string
          schedule_id: string | null
          taken_at: string
          status: Database['public']['Enums']['dose_status']
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          medication_id: string
          schedule_id?: string | null
          taken_at?: string
          status?: Database['public']['Enums']['dose_status']
          notes?: string | null
          created_at?: string
        }
        Update: {
          taken_at?: string
          status?: Database['public']['Enums']['dose_status']
          notes?: string | null
        }
        Relationships: []
      }
      appointments: {
        Row: {
          id: string
          user_id: string
          title: string
          doctor: string | null
          location: string | null
          commute_minutes: number
          start_time: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          title: string
          doctor?: string | null
          location?: string | null
          commute_minutes?: number
          start_time: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          doctor?: string | null
          location?: string | null
          commute_minutes?: number
          start_time?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      refills: {
        Row: {
          id: string
          medication_id: string
          user_id: string
          current_quantity: number
          total_quantity: number
          refill_date: string | null
          pharmacy: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          medication_id: string
          user_id?: string
          current_quantity?: number
          total_quantity?: number
          refill_date?: string | null
          pharmacy?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          current_quantity?: number
          total_quantity?: number
          refill_date?: string | null
          pharmacy?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          id: string
          user_id: string
          content: string
          medication_id: string | null
          appointment_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          content: string
          medication_id?: string | null
          appointment_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          content?: string
          medication_id?: string | null
          appointment_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          message: string
          type: Database['public']['Enums']['notification_type']
          read: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          title: string
          message: string
          type?: Database['public']['Enums']['notification_type']
          read?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          message?: string
          type?: Database['public']['Enums']['notification_type']
          read?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          device_info: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          endpoint: string
          p256dh: string
          auth: string
          device_info?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          endpoint?: string
          p256dh?: string
          auth?: string
          device_info?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          id: string
          user_id: string
          role: string
          content: string
          model: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          role: string
          content: string
          model?: string | null
          created_at?: string
        }
        Update: {
          role?: string
          content?: string
          model?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      create_medication_bundle: {
        Args: {
          medication_name: string
          medication_dosage: string | null
          medication_instructions: string | null
          medication_warnings: string | null
          medication_freq: number
          medication_color: string
          medication_icon: string | null
          schedule_times: string[]
          schedule_days: number[]
          refill_current_quantity: number
          refill_total_quantity: number
          refill_date: string | null
          refill_pharmacy: string | null
        }
        Returns: string
      }
    }
    CompositeTypes: Record<string, never>
  }
}