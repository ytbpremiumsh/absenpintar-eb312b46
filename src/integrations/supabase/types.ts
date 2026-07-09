export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      affiliate_commissions: {
        Row: {
          affiliate_id: string
          commission_amount: number
          commission_rate: number
          created_at: string
          id: string
          is_first_payment: boolean
          paid_at: string | null
          plan_name: string
          plan_price: number
          school_id: string | null
          status: string
        }
        Insert: {
          affiliate_id: string
          commission_amount: number
          commission_rate: number
          created_at?: string
          id?: string
          is_first_payment?: boolean
          paid_at?: string | null
          plan_name: string
          plan_price: number
          school_id?: string | null
          status?: string
        }
        Update: {
          affiliate_id?: string
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          id?: string
          is_first_payment?: boolean
          paid_at?: string | null
          plan_name?: string
          plan_price?: number
          school_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commissions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_withdrawals: {
        Row: {
          account_holder: string
          account_number: string
          admin_notes: string | null
          affiliate_id: string
          amount: number
          bank_name: string
          created_at: string
          estimated_payout_at: string | null
          ewallet_type: string | null
          id: string
          processed_at: string | null
          status: string
        }
        Insert: {
          account_holder: string
          account_number: string
          admin_notes?: string | null
          affiliate_id: string
          amount: number
          bank_name: string
          created_at?: string
          estimated_payout_at?: string | null
          ewallet_type?: string | null
          id?: string
          processed_at?: string | null
          status?: string
        }
        Update: {
          account_holder?: string
          account_number?: string
          admin_notes?: string | null
          affiliate_id?: string
          amount?: number
          bank_name?: string
          created_at?: string
          estimated_payout_at?: string | null
          ewallet_type?: string | null
          id?: string
          processed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_withdrawals_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          affiliate_code: string
          commission_rate: number
          created_at: string
          current_balance: number
          email: string
          full_name: string
          id: string
          password_hash: string
          phone: string | null
          status: string
          total_earned: number
          total_withdrawn: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          affiliate_code: string
          commission_rate?: number
          created_at?: string
          current_balance?: number
          email: string
          full_name: string
          id?: string
          password_hash: string
          phone?: string | null
          status?: string
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          affiliate_code?: string
          commission_rate?: number
          created_at?: string
          current_balance?: number
          email?: string
          full_name?: string
          id?: string
          password_hash?: string
          phone?: string | null
          status?: string
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      attendance_logs: {
        Row: {
          attendance_type: string
          created_at: string
          date: string
          id: string
          method: string
          notes: string | null
          recorded_by: string | null
          school_id: string
          status: string
          student_id: string
          time: string
        }
        Insert: {
          attendance_type?: string
          created_at?: string
          date?: string
          id?: string
          method?: string
          notes?: string | null
          recorded_by?: string | null
          school_id: string
          status?: string
          student_id: string
          time?: string
        }
        Update: {
          attendance_type?: string
          created_at?: string
          date?: string
          id?: string
          method?: string
          notes?: string | null
          recorded_by?: string | null
          school_id?: string
          status?: string
          student_id?: string
          time?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_email_templates: {
        Row: {
          html: string
          id: string
          sender_name: string
          subject: string
          type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          html: string
          id?: string
          sender_name?: string
          subject: string
          type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          html?: string
          id?: string
          sender_name?: string
          subject?: string
          type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      bendahara_bank_accounts: {
        Row: {
          account_holder: string
          account_number: string
          account_type: string
          bank_name: string
          created_at: string
          created_by: string | null
          doku_bank_code: string | null
          id: string
          is_default: boolean
          notes: string | null
          responsible_user_id: string | null
          school_id: string
          updated_at: string
        }
        Insert: {
          account_holder: string
          account_number: string
          account_type?: string
          bank_name: string
          created_at?: string
          created_by?: string | null
          doku_bank_code?: string | null
          id?: string
          is_default?: boolean
          notes?: string | null
          responsible_user_id?: string | null
          school_id: string
          updated_at?: string
        }
        Update: {
          account_holder?: string
          account_number?: string
          account_type?: string
          bank_name?: string
          created_at?: string
          created_by?: string | null
          doku_bank_code?: string | null
          id?: string
          is_default?: boolean
          notes?: string | null
          responsible_user_id?: string | null
          school_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      bendahara_otps: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          otp_code: string
          phone: string
          school_id: string
          used: boolean
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          otp_code: string
          phone: string
          school_id: string
          used?: boolean
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          otp_code?: string
          phone?: string
          school_id?: string
          used?: boolean
        }
        Relationships: []
      }
      bendahara_settings: {
        Row: {
          api_key: string | null
          confirmer_user_id: string | null
          created_at: string
          environment: string
          id: string
          last_test_status: string | null
          last_tested_at: string | null
          school_id: string
          secret_key: string | null
          updated_at: string
          use_platform_key: boolean
          webhook_url: string | null
        }
        Insert: {
          api_key?: string | null
          confirmer_user_id?: string | null
          created_at?: string
          environment?: string
          id?: string
          last_test_status?: string | null
          last_tested_at?: string | null
          school_id: string
          secret_key?: string | null
          updated_at?: string
          use_platform_key?: boolean
          webhook_url?: string | null
        }
        Update: {
          api_key?: string | null
          confirmer_user_id?: string | null
          created_at?: string
          environment?: string
          id?: string
          last_test_status?: string | null
          last_tested_at?: string | null
          school_id?: string
          secret_key?: string | null
          updated_at?: string
          use_platform_key?: boolean
          webhook_url?: string | null
        }
        Relationships: []
      }
      cash_book_entries: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          direction: string
          entry_date: string
          id: string
          reference: string | null
          school_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          direction: string
          entry_date?: string
          id?: string
          reference?: string | null
          school_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          direction?: string
          entry_date?: string
          id?: string
          reference?: string | null
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_book_entries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_book_entries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      class_teachers: {
        Row: {
          class_name: string
          created_at: string
          id: string
          school_id: string
          user_id: string
        }
        Insert: {
          class_name: string
          created_at?: string
          id?: string
          school_id: string
          user_id: string
        }
        Update: {
          class_name?: string
          created_at?: string
          id?: string
          school_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_teachers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_teachers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          id: string
          name: string
          school_id: string
          wa_group_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          school_id: string
          wa_group_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          school_id?: string
          wa_group_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      dismissal_logs: {
        Row: {
          created_at: string
          dismissal_time: string
          dismissed_by: string
          id: string
          school_id: string
          status: string
          student_id: string
        }
        Insert: {
          created_at?: string
          dismissal_time?: string
          dismissed_by: string
          id?: string
          school_id: string
          status?: string
          student_id: string
        }
        Update: {
          created_at?: string
          dismissal_time?: string
          dismissed_by?: string
          id?: string
          school_id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pickup_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pickup_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pickup_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      dismissal_settings: {
        Row: {
          attendance_end_time: string | null
          attendance_start_time: string | null
          created_at: string
          departure_end_time: string | null
          departure_start_time: string | null
          id: string
          is_active: boolean
          school_end_time: string | null
          school_id: string
          school_start_time: string | null
        }
        Insert: {
          attendance_end_time?: string | null
          attendance_start_time?: string | null
          created_at?: string
          departure_end_time?: string | null
          departure_start_time?: string | null
          id?: string
          is_active?: boolean
          school_end_time?: string | null
          school_id: string
          school_start_time?: string | null
        }
        Update: {
          attendance_end_time?: string | null
          attendance_start_time?: string | null
          created_at?: string
          departure_end_time?: string | null
          departure_start_time?: string | null
          id?: string
          is_active?: boolean
          school_end_time?: string | null
          school_id?: string
          school_start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pickup_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pickup_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          created_at: string
          error: string | null
          event_type: string
          id: string
          school_id: string | null
          status: string
          subject: string
          to_email: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_type: string
          id?: string
          school_id?: string | null
          status: string
          subject: string
          to_email: string
        }
        Update: {
          created_at?: string
          error?: string | null
          event_type?: string
          id?: string
          school_id?: string | null
          status?: string
          subject?: string
          to_email?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_settings: {
        Row: {
          created_at: string
          from_email: string
          from_name: string
          id: string
          is_active: boolean
          send_on_register: boolean
          send_on_spp_paid: boolean
          smtp_host: string
          smtp_password: string
          smtp_port: number
          smtp_secure: boolean
          smtp_username: string
          template_register_html: string
          template_register_subject: string
          template_spp_html: string
          template_spp_subject: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_email: string
          from_name?: string
          id?: string
          is_active?: boolean
          send_on_register?: boolean
          send_on_spp_paid?: boolean
          smtp_host: string
          smtp_password: string
          smtp_port?: number
          smtp_secure?: boolean
          smtp_username: string
          template_register_html?: string
          template_register_subject?: string
          template_spp_html?: string
          template_spp_subject?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_email?: string
          from_name?: string
          id?: string
          is_active?: boolean
          send_on_register?: boolean
          send_on_spp_paid?: boolean
          smtp_host?: string
          smtp_password?: string
          smtp_port?: number
          smtp_secure?: boolean
          smtp_username?: string
          template_register_html?: string
          template_register_subject?: string
          template_spp_html?: string
          template_spp_subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      id_card_designs: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          preview_url: string | null
          preview_url_back: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          preview_url?: string | null
          preview_url_back?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          preview_url?: string | null
          preview_url_back?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      id_card_order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          student_class: string
          student_id: string
          student_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          student_class: string
          student_id: string
          student_name: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          student_class?: string
          student_id?: string
          student_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "id_card_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "id_card_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "id_card_order_items_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      id_card_orders: {
        Row: {
          created_at: string
          design_id: string | null
          id: string
          notes: string | null
          payment_transaction_id: string | null
          price_per_card: number
          progress: string
          school_id: string
          status: string
          total_amount: number
          total_cards: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          design_id?: string | null
          id?: string
          notes?: string | null
          payment_transaction_id?: string | null
          price_per_card?: number
          progress?: string
          school_id: string
          status?: string
          total_amount?: number
          total_cards?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          design_id?: string | null
          id?: string
          notes?: string | null
          payment_transaction_id?: string | null
          price_per_card?: number
          progress?: string
          school_id?: string
          status?: string
          total_amount?: number
          total_cards?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "id_card_orders_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "id_card_designs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "id_card_orders_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "id_card_orders_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "id_card_orders_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_content: {
        Row: {
          created_at: string
          id: string
          key: string
          type: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          type?: string
          updated_at?: string
          value?: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          type?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      landing_testimonials: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          rating: number
          role: string
          sort_order: number
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          rating?: number
          role: string
          sort_order?: number
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          rating?: number
          role?: string
          sort_order?: number
          text?: string
        }
        Relationships: []
      }
      landing_trusted_schools: {
        Row: {
          created_at: string
          id: string
          initials: string
          is_active: boolean
          logo_url: string | null
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          initials: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          initials?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      login_logs: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          ip_address: string | null
          role: string | null
          school_name: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          ip_address?: string | null
          role?: string | null
          school_name?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          ip_address?: string | null
          role?: string | null
          school_name?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_read: boolean
          message: string
          school_id: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_read?: boolean
          message: string
          school_id?: string | null
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_read?: boolean
          message?: string
          school_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      package_audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          reason: string | null
          school_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
          school_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "package_audit_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_audit_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      package_settings: {
        Row: {
          disabled_features: Json
          grace_period_days: number
          id: number
          mandiri_monthly_rate: number
          updated_at: string
        }
        Insert: {
          disabled_features?: Json
          grace_period_days?: number
          id?: number
          mandiri_monthly_rate?: number
          updated_at?: string
        }
        Update: {
          disabled_features?: Json
          grace_period_days?: number
          id?: number
          mandiri_monthly_rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      panduan_content: {
        Row: {
          color: string
          cover: string | null
          created_at: string
          highlights: Json
          id: string
          intro: string
          label: string
          mobile_mockup: string | null
          mobile_mockup_enabled: boolean
          role_id: string
          short_label: string
          sort_order: number
          steps: Json
          updated_at: string
        }
        Insert: {
          color?: string
          cover?: string | null
          created_at?: string
          highlights?: Json
          id?: string
          intro?: string
          label: string
          mobile_mockup?: string | null
          mobile_mockup_enabled?: boolean
          role_id: string
          short_label: string
          sort_order?: number
          steps?: Json
          updated_at?: string
        }
        Update: {
          color?: string
          cover?: string | null
          created_at?: string
          highlights?: Json
          id?: string
          intro?: string
          label?: string
          mobile_mockup?: string | null
          mobile_mockup_enabled?: boolean
          role_id?: string
          short_label?: string
          sort_order?: number
          steps?: Json
          updated_at?: string
        }
        Relationships: []
      }
      parent_leave_requests: {
        Row: {
          attachment_url: string | null
          created_at: string
          date: string
          id: string
          parent_phone: string
          reason: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          school_id: string
          status: string
          student_id: string
          type: string
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string
          date: string
          id?: string
          parent_phone: string
          reason?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id: string
          status?: string
          student_id: string
          type: string
        }
        Update: {
          attachment_url?: string | null
          created_at?: string
          date?: string
          id?: string
          parent_phone?: string
          reason?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string
          status?: string
          student_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_leave_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          parent_phone: string
          read_at: string | null
          school_id: string
          sender_type: string
          student_id: string
          teacher_user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          parent_phone: string
          read_at?: string | null
          school_id: string
          sender_type: string
          student_id: string
          teacher_user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          parent_phone?: string
          read_at?: string | null
          school_id?: string
          sender_type?: string
          student_id?: string
          teacher_user_id?: string | null
        }
        Relationships: []
      }
      parent_otps: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          otp_code: string
          phone: string
          used: boolean
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          otp_code: string
          phone: string
          used?: boolean
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          otp_code?: string
          phone?: string
          used?: boolean
        }
        Relationships: []
      }
      parent_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          phone: string
          token: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          phone: string
          token: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          token?: string
        }
        Relationships: []
      }
      password_reset_otps: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          otp_code: string
          phone: string
          used: boolean
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          otp_code: string
          phone: string
          used?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          otp_code?: string
          phone?: string
          used?: boolean
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          mayar_payment_url: string | null
          mayar_transaction_id: string | null
          paid_at: string | null
          payment_channel: string | null
          payment_method: string | null
          plan_id: string
          school_id: string
          service_fee: number
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          mayar_payment_url?: string | null
          mayar_transaction_id?: string | null
          paid_at?: string | null
          payment_channel?: string | null
          payment_method?: string | null
          plan_id: string
          school_id: string
          service_fee?: number
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          mayar_payment_url?: string | null
          mayar_transaction_id?: string | null
          paid_at?: string | null
          payment_channel?: string | null
          payment_method?: string | null
          plan_id?: string
          school_id?: string
          service_fee?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_types: {
        Row: {
          amount: number
          applies_to: string
          category: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          period: string
          school_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          applies_to?: string
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          period?: string
          school_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          applies_to?: string
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          period?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_types_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_types_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      point_transactions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          points: number
          source: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          points: number
          source: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          points?: number
          source?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          current_points: number
          full_name: string
          id: string
          lifetime_points: number
          nip: string | null
          phone: string | null
          photo_url: string | null
          position: string | null
          qr_code: string | null
          referral_code: string | null
          referred_by: string | null
          rfid_uid: string | null
          school_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          current_points?: number
          full_name: string
          id?: string
          lifetime_points?: number
          nip?: string | null
          phone?: string | null
          photo_url?: string | null
          position?: string | null
          qr_code?: string | null
          referral_code?: string | null
          referred_by?: string | null
          rfid_uid?: string | null
          school_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          current_points?: number
          full_name?: string
          id?: string
          lifetime_points?: number
          nip?: string | null
          phone?: string | null
          photo_url?: string | null
          position?: string | null
          qr_code?: string | null
          referral_code?: string | null
          referred_by?: string | null
          rfid_uid?: string | null
          school_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_content: {
        Row: {
          created_at: string
          id: string
          key: string
          type: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          type?: string
          updated_at?: string
          value?: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          type?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      qr_instructions: {
        Row: {
          created_at: string
          id: string
          instruction_text: string
          school_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          instruction_text: string
          school_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          instruction_text?: string
          school_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "qr_instructions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_instructions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          points_awarded: number
          referred_user_id: string
          referrer_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          points_awarded?: number
          referred_user_id: string
          referrer_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          points_awarded?: number
          referred_user_id?: string
          referrer_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      reward_claims: {
        Row: {
          created_at: string
          id: string
          points_used: number
          reward_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          points_used: number
          reward_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          points_used?: number
          reward_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_claims_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      rewards: {
        Row: {
          created_at: string
          description: string | null
          duration_days: number
          id: string
          is_active: boolean
          name: string
          points_required: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_days: number
          id?: string
          is_active?: boolean
          name: string
          points_required: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_days?: number
          id?: string
          is_active?: boolean
          name?: string
          points_required?: number
          sort_order?: number
        }
        Relationships: []
      }
      rfid_device_licenses: {
        Row: {
          created_at: string
          id: string
          license_count: number
          notes: string | null
          school_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          license_count?: number
          notes?: string | null
          school_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          license_count?: number
          notes?: string | null
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfid_device_licenses_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfid_device_licenses_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      rfid_device_logs: {
        Row: {
          created_at: string
          device_id: string | null
          device_ref: string | null
          event_type: string
          id: string
          payload: Json
          school_id: string | null
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          device_ref?: string | null
          event_type: string
          id?: string
          payload?: Json
          school_id?: string | null
        }
        Update: {
          created_at?: string
          device_id?: string | null
          device_ref?: string | null
          event_type?: string
          id?: string
          payload?: Json
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfid_device_logs_device_ref_fkey"
            columns: ["device_ref"]
            isOneToOne: false
            referencedRelation: "rfid_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfid_device_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfid_device_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      rfid_devices: {
        Row: {
          activated_at: string | null
          activation_code: string
          created_at: string
          device_id: string
          firmware_version: string | null
          id: string
          last_heartbeat_at: string | null
          last_ip: string | null
          last_online_at: string | null
          location_label: string | null
          mac_address: string | null
          notes: string | null
          school_id: string | null
          secret_token_hash: string | null
          serial_number: string
          status: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          activation_code: string
          created_at?: string
          device_id: string
          firmware_version?: string | null
          id?: string
          last_heartbeat_at?: string | null
          last_ip?: string | null
          last_online_at?: string | null
          location_label?: string | null
          mac_address?: string | null
          notes?: string | null
          school_id?: string | null
          secret_token_hash?: string | null
          serial_number: string
          status?: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          activation_code?: string
          created_at?: string
          device_id?: string
          firmware_version?: string | null
          id?: string
          last_heartbeat_at?: string | null
          last_ip?: string | null
          last_online_at?: string | null
          location_label?: string | null
          mac_address?: string | null
          notes?: string | null
          school_id?: string | null
          secret_token_hash?: string | null
          serial_number?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfid_devices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfid_devices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      rfid_size_tiers: {
        Row: {
          created_at: string
          id: string
          max_students: number | null
          min_devices: number
          min_students: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_students?: number | null
          min_devices: number
          min_students: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          max_students?: number | null
          min_devices?: number
          min_students?: number
          updated_at?: string
        }
        Relationships: []
      }
      school_addons: {
        Row: {
          addon_type: string
          amount: number
          created_at: string
          custom_domain: string | null
          domain_status: string
          expires_at: string | null
          id: string
          payment_transaction_id: string | null
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          addon_type?: string
          amount?: number
          created_at?: string
          custom_domain?: string | null
          domain_status?: string
          expires_at?: string | null
          id?: string
          payment_transaction_id?: string | null
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          addon_type?: string
          amount?: number
          created_at?: string
          custom_domain?: string | null
          domain_status?: string
          expires_at?: string | null
          id?: string
          payment_transaction_id?: string | null
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_addons_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_addons_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_addons_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      school_announcements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_pinned: boolean
          message: string
          school_id: string
          target_audience: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_pinned?: boolean
          message: string
          school_id: string
          target_audience?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_pinned?: boolean
          message?: string
          school_id?: string
          target_audience?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      school_groups: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      school_holidays: {
        Row: {
          created_at: string
          date: string
          description: string | null
          event_type: string
          id: string
          is_holiday: boolean
          label: string | null
          school_id: string
        }
        Insert: {
          created_at?: string
          date: string
          description?: string | null
          event_type?: string
          id?: string
          is_holiday?: boolean
          label?: string | null
          school_id: string
        }
        Update: {
          created_at?: string
          date?: string
          description?: string | null
          event_type?: string
          id?: string
          is_holiday?: boolean
          label?: string | null
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_holidays_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_holidays_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      school_integrations: {
        Row: {
          api_key: string | null
          api_url: string | null
          attendance_arrive_template: string | null
          attendance_depart_template: string | null
          attendance_group_template: string | null
          created_at: string
          gateway_type: string
          id: string
          integration_type: string
          is_active: boolean
          message_template: string | null
          mpwa_api_key: string | null
          mpwa_connected: boolean
          mpwa_sender: string | null
          school_id: string
          teaching_reminder_enabled: boolean | null
          teaching_reminder_template: string | null
          updated_at: string
          wa_delivery_target: string | null
          wa_enabled: boolean | null
        }
        Insert: {
          api_key?: string | null
          api_url?: string | null
          attendance_arrive_template?: string | null
          attendance_depart_template?: string | null
          attendance_group_template?: string | null
          created_at?: string
          gateway_type?: string
          id?: string
          integration_type?: string
          is_active?: boolean
          message_template?: string | null
          mpwa_api_key?: string | null
          mpwa_connected?: boolean
          mpwa_sender?: string | null
          school_id: string
          teaching_reminder_enabled?: boolean | null
          teaching_reminder_template?: string | null
          updated_at?: string
          wa_delivery_target?: string | null
          wa_enabled?: boolean | null
        }
        Update: {
          api_key?: string | null
          api_url?: string | null
          attendance_arrive_template?: string | null
          attendance_depart_template?: string | null
          attendance_group_template?: string | null
          created_at?: string
          gateway_type?: string
          id?: string
          integration_type?: string
          is_active?: boolean
          message_template?: string | null
          mpwa_api_key?: string | null
          mpwa_connected?: boolean
          mpwa_sender?: string | null
          school_id?: string
          teaching_reminder_enabled?: boolean | null
          teaching_reminder_template?: string | null
          updated_at?: string
          wa_delivery_target?: string | null
          wa_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "school_integrations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_integrations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      school_subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          plan_id: string
          school_id: string
          started_at: string
          status: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          plan_id: string
          school_id: string
          started_at?: string
          status?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          plan_id?: string
          school_id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_subscriptions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_subscriptions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          address: string | null
          bendahara_offline_enabled: boolean
          bendahara_wa_enabled: boolean
          city: string | null
          created_at: string
          email: string | null
          group_id: string | null
          holiday_days: number[]
          holiday_mode: boolean
          holiday_mode_label: string | null
          id: string
          installment_enabled: boolean
          is_suspended: boolean
          last_payment_activity_at: string | null
          logo: string | null
          mandiri_monthly_rate: number
          name: string
          npsn: string | null
          package_status: string
          package_status_changed_at: string | null
          package_type: string
          principal_name: string | null
          province: string | null
          rfid_mode: string
          slug: string
          slug_updated_at: string | null
          suspended_at: string | null
          suspended_reason: string | null
          timezone: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          bendahara_offline_enabled?: boolean
          bendahara_wa_enabled?: boolean
          city?: string | null
          created_at?: string
          email?: string | null
          group_id?: string | null
          holiday_days?: number[]
          holiday_mode?: boolean
          holiday_mode_label?: string | null
          id?: string
          installment_enabled?: boolean
          is_suspended?: boolean
          last_payment_activity_at?: string | null
          logo?: string | null
          mandiri_monthly_rate?: number
          name: string
          npsn?: string | null
          package_status?: string
          package_status_changed_at?: string | null
          package_type?: string
          principal_name?: string | null
          province?: string | null
          rfid_mode?: string
          slug: string
          slug_updated_at?: string | null
          suspended_at?: string | null
          suspended_reason?: string | null
          timezone?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          bendahara_offline_enabled?: boolean
          bendahara_wa_enabled?: boolean
          city?: string | null
          created_at?: string
          email?: string | null
          group_id?: string | null
          holiday_days?: number[]
          holiday_mode?: boolean
          holiday_mode_label?: string | null
          id?: string
          installment_enabled?: boolean
          is_suspended?: boolean
          last_payment_activity_at?: string | null
          logo?: string | null
          mandiri_monthly_rate?: number
          name?: string
          npsn?: string | null
          package_status?: string
          package_status_changed_at?: string | null
          package_type?: string
          principal_name?: string | null
          province?: string | null
          rfid_mode?: string
          slug?: string
          slug_updated_at?: string | null
          suspended_at?: string | null
          suspended_reason?: string | null
          timezone?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schools_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "school_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      short_link_clicks: {
        Row: {
          clicked_at: string
          country: string | null
          id: string
          ip: string | null
          link_id: string
          referer: string | null
          user_agent: string | null
        }
        Insert: {
          clicked_at?: string
          country?: string | null
          id?: string
          ip?: string | null
          link_id: string
          referer?: string | null
          user_agent?: string | null
        }
        Update: {
          clicked_at?: string
          country?: string | null
          id?: string
          ip?: string | null
          link_id?: string
          referer?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "short_link_clicks_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "short_links"
            referencedColumns: ["id"]
          },
        ]
      }
      short_links: {
        Row: {
          click_count: number
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          target_url: string
          title: string | null
          updated_at: string
        }
        Insert: {
          click_count?: number
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          target_url: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          click_count?: number
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          target_url?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      spp_installments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          expired_at: string | null
          gateway: string | null
          id: string
          invoice_id: string
          mayar_invoice_id: string | null
          mayar_payment_url: string | null
          mayar_transaction_id: string | null
          notes: string | null
          paid_at: string | null
          payment_channel: string | null
          payment_method: string
          school_id: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          expired_at?: string | null
          gateway?: string | null
          id?: string
          invoice_id: string
          mayar_invoice_id?: string | null
          mayar_payment_url?: string | null
          mayar_transaction_id?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_channel?: string | null
          payment_method?: string
          school_id: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          expired_at?: string | null
          gateway?: string | null
          id?: string
          invoice_id?: string
          mayar_invoice_id?: string | null
          mayar_payment_url?: string | null
          mayar_transaction_id?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_channel?: string | null
          payment_method?: string
          school_id?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spp_installments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "spp_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      spp_invoices: {
        Row: {
          allow_installment: boolean
          amount: number
          bill_category: string | null
          bill_type: string
          class_name: string
          created_at: string
          denda: number
          description: string
          due_date: string
          expired_at: string | null
          gateway_fee: number
          id: string
          installment_paid_amount: number
          invoice_number: string
          mayar_invoice_id: string | null
          net_amount: number
          paid_at: string | null
          parent_email: string | null
          parent_name: string | null
          parent_phone: string | null
          payment_channel: string | null
          payment_method: string | null
          payment_url: string | null
          period_label: string
          period_month: number
          period_year: number
          qr_code: string | null
          regenerated_from: string | null
          school_id: string
          service_fee: number
          settlement_id: string | null
          status: string
          student_id: string
          student_name: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          allow_installment?: boolean
          amount?: number
          bill_category?: string | null
          bill_type?: string
          class_name: string
          created_at?: string
          denda?: number
          description: string
          due_date: string
          expired_at?: string | null
          gateway_fee?: number
          id?: string
          installment_paid_amount?: number
          invoice_number: string
          mayar_invoice_id?: string | null
          net_amount?: number
          paid_at?: string | null
          parent_email?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          payment_channel?: string | null
          payment_method?: string | null
          payment_url?: string | null
          period_label: string
          period_month: number
          period_year: number
          qr_code?: string | null
          regenerated_from?: string | null
          school_id: string
          service_fee?: number
          settlement_id?: string | null
          status?: string
          student_id: string
          student_name: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          allow_installment?: boolean
          amount?: number
          bill_category?: string | null
          bill_type?: string
          class_name?: string
          created_at?: string
          denda?: number
          description?: string
          due_date?: string
          expired_at?: string | null
          gateway_fee?: number
          id?: string
          installment_paid_amount?: number
          invoice_number?: string
          mayar_invoice_id?: string | null
          net_amount?: number
          paid_at?: string | null
          parent_email?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          payment_channel?: string | null
          payment_method?: string | null
          payment_url?: string | null
          period_label?: string
          period_month?: number
          period_year?: number
          qr_code?: string | null
          regenerated_from?: string | null
          school_id?: string
          service_fee?: number
          settlement_id?: string | null
          status?: string
          student_id?: string
          student_name?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      spp_logs: {
        Row: {
          created_at: string
          event_type: string
          id: string
          invoice_id: string | null
          message: string | null
          payload: Json | null
          school_id: string | null
          status: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          invoice_id?: string | null
          message?: string | null
          payload?: Json | null
          school_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          invoice_id?: string | null
          message?: string | null
          payload?: Json | null
          school_id?: string | null
          status?: string | null
        }
        Relationships: []
      }
      spp_settlements: {
        Row: {
          account_holder: string | null
          account_number: string | null
          account_type: string
          admin_notes: string | null
          approved_at: string | null
          bank_name: string | null
          created_at: string
          disbursement_callback_at: string | null
          disbursement_error: string | null
          disbursement_method: string
          disbursement_response: Json | null
          disbursement_status: string | null
          doku_partner_reference_no: string | null
          doku_reference_id: string | null
          final_payout: number
          id: string
          notes: string | null
          paid_at: string | null
          requested_at: string
          requested_by: string | null
          responsible_user_id: string | null
          reviewed_by: string | null
          school_id: string
          settlement_code: string
          status: string
          total_gateway_fee: number
          total_gross: number
          total_net: number
          total_transactions: number
          updated_at: string
          withdraw_fee: number
        }
        Insert: {
          account_holder?: string | null
          account_number?: string | null
          account_type?: string
          admin_notes?: string | null
          approved_at?: string | null
          bank_name?: string | null
          created_at?: string
          disbursement_callback_at?: string | null
          disbursement_error?: string | null
          disbursement_method?: string
          disbursement_response?: Json | null
          disbursement_status?: string | null
          doku_partner_reference_no?: string | null
          doku_reference_id?: string | null
          final_payout?: number
          id?: string
          notes?: string | null
          paid_at?: string | null
          requested_at?: string
          requested_by?: string | null
          responsible_user_id?: string | null
          reviewed_by?: string | null
          school_id: string
          settlement_code: string
          status?: string
          total_gateway_fee?: number
          total_gross?: number
          total_net?: number
          total_transactions?: number
          updated_at?: string
          withdraw_fee?: number
        }
        Update: {
          account_holder?: string | null
          account_number?: string | null
          account_type?: string
          admin_notes?: string | null
          approved_at?: string | null
          bank_name?: string | null
          created_at?: string
          disbursement_callback_at?: string | null
          disbursement_error?: string | null
          disbursement_method?: string
          disbursement_response?: Json | null
          disbursement_status?: string | null
          doku_partner_reference_no?: string | null
          doku_reference_id?: string | null
          final_payout?: number
          id?: string
          notes?: string | null
          paid_at?: string | null
          requested_at?: string
          requested_by?: string | null
          responsible_user_id?: string | null
          reviewed_by?: string | null
          school_id?: string
          settlement_code?: string
          status?: string
          total_gateway_fee?: number
          total_gross?: number
          total_net?: number
          total_transactions?: number
          updated_at?: string
          withdraw_fee?: number
        }
        Relationships: []
      }
      spp_tariff_discounts: {
        Row: {
          amount: number
          category: string
          created_at: string
          discount_type: string
          id: string
          percent: number
          school_id: string
          student_id: string
          tariff_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          discount_type?: string
          id?: string
          percent?: number
          school_id: string
          student_id: string
          tariff_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          discount_type?: string
          id?: string
          percent?: number
          school_id?: string
          student_id?: string
          tariff_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spp_tariff_discounts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spp_tariff_discounts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spp_tariff_discounts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spp_tariff_discounts_tariff_id_fkey"
            columns: ["tariff_id"]
            isOneToOne: false
            referencedRelation: "spp_tariffs"
            referencedColumns: ["id"]
          },
        ]
      }
      spp_tariffs: {
        Row: {
          amount: number
          class_name: string
          created_at: string
          denda: number
          due_date_day: number
          id: string
          is_active: boolean
          school_id: string
          school_year: string
          updated_at: string
        }
        Insert: {
          amount?: number
          class_name: string
          created_at?: string
          denda?: number
          due_date_day?: number
          id?: string
          is_active?: boolean
          school_id: string
          school_year: string
          updated_at?: string
        }
        Update: {
          amount?: number
          class_name?: string
          created_at?: string
          denda?: number
          due_date_day?: number
          id?: string
          is_active?: boolean
          school_id?: string
          school_year?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_grades: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          school_id: string
          school_year: string
          score: number
          semester: string
          student_id: string
          subject: string
          term: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          school_id: string
          school_year: string
          score: number
          semester: string
          student_id: string
          subject: string
          term?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          school_id?: string
          school_year?: string
          score?: number
          semester?: string
          student_id?: string
          subject?: string
          term?: string
          updated_at?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          card_number: string | null
          class: string
          created_at: string
          gender: string
          id: string
          name: string
          parent_name: string
          parent_phone: string
          photo_url: string | null
          qr_code: string
          rfid_uid: string | null
          school_id: string
          student_id: string
        }
        Insert: {
          card_number?: string | null
          class: string
          created_at?: string
          gender?: string
          id?: string
          name: string
          parent_name: string
          parent_phone: string
          photo_url?: string | null
          qr_code: string
          rfid_uid?: string | null
          school_id: string
          student_id: string
        }
        Update: {
          card_number?: string | null
          class?: string
          created_at?: string
          gender?: string
          id?: string
          name?: string
          parent_name?: string
          parent_phone?: string
          photo_url?: string | null
          qr_code?: string
          rfid_uid?: string | null
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_attendance: {
        Row: {
          created_at: string
          date: string
          id: string
          notes: string | null
          school_id: string
          status: string
          student_id: string
          teacher_id: string
          teaching_schedule_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          school_id: string
          status?: string
          student_id: string
          teacher_id: string
          teaching_schedule_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          school_id?: string
          status?: string
          student_id?: string
          teacher_id?: string
          teaching_schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_attendance_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_attendance_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_attendance_teaching_schedule_id_fkey"
            columns: ["teaching_schedule_id"]
            isOneToOne: false
            referencedRelation: "teaching_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          code: string | null
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          school_id: string
        }
        Insert: {
          code?: string | null
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          school_id: string
        }
        Update: {
          code?: string | null
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          max_students: number | null
          name: string
          price: number
          show_on_landing: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          max_students?: number | null
          name: string
          price?: number
          show_on_landing?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          max_students?: number | null
          name?: string
          price?: number
          show_on_landing?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          admin_reply: string | null
          created_at: string
          id: string
          message: string
          priority: string
          replied_at: string | null
          school_id: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_reply?: string | null
          created_at?: string
          id?: string
          message: string
          priority?: string
          replied_at?: string | null
          school_id: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_reply?: string | null
          created_at?: string
          id?: string
          message?: string
          priority?: string
          replied_at?: string | null
          school_id?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      teacher_attendance_logs: {
        Row: {
          attendance_type: string
          created_at: string
          date: string
          id: string
          method: string
          notes: string | null
          recorded_by: string | null
          school_id: string
          status: string
          time: string
          user_id: string
        }
        Insert: {
          attendance_type?: string
          created_at?: string
          date?: string
          id?: string
          method?: string
          notes?: string | null
          recorded_by?: string | null
          school_id: string
          status?: string
          time?: string
          user_id: string
        }
        Update: {
          attendance_type?: string
          created_at?: string
          date?: string
          id?: string
          method?: string
          notes?: string | null
          recorded_by?: string | null
          school_id?: string
          status?: string
          time?: string
          user_id?: string
        }
        Relationships: []
      }
      teaching_schedules: {
        Row: {
          class_id: string
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          notes: string | null
          room: string | null
          school_id: string
          start_time: string
          subject_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean
          notes?: string | null
          room?: string | null
          school_id: string
          start_time: string
          subject_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          room?: string | null
          school_id?: string
          start_time?: string
          subject_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teaching_schedules_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_schedules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_schedules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_schedules_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_replies: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          is_admin: boolean
          message: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_admin?: boolean
          message: string
          ticket_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_admin?: boolean
          message?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wa_credits: {
        Row: {
          balance: number
          created_at: string
          id: string
          school_id: string
          total_purchased: number
          total_used: number
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          school_id: string
          total_purchased?: number
          total_used?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          school_id?: string
          total_purchased?: number
          total_used?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_credits_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_credits_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_message_logs: {
        Row: {
          created_at: string
          group_id: string | null
          id: string
          message: string
          message_type: string
          phone: string | null
          school_id: string
          status: string
          student_name: string | null
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          id?: string
          message: string
          message_type?: string
          phone?: string | null
          school_id: string
          status?: string
          student_name?: string | null
        }
        Update: {
          created_at?: string
          group_id?: string | null
          id?: string
          message?: string
          message_type?: string
          phone?: string | null
          school_id?: string
          status?: string
          student_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wa_message_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_message_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      schools_public: {
        Row: {
          city: string | null
          id: string | null
          logo: string | null
          name: string | null
          slug: string | null
        }
        Insert: {
          city?: string | null
          id?: string | null
          logo?: string | null
          name?: string | null
          slug?: string | null
        }
        Update: {
          city?: string | null
          id?: string | null
          logo?: string | null
          name?: string | null
          slug?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _fmt_idr: { Args: { amt: number }; Returns: string }
      check_package_status: { Args: never; Returns: undefined }
      cleanup_old_logs: { Args: never; Returns: undefined }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      generate_student_card_number: { Args: never; Returns: string }
      get_user_school_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_shortlink_click: { Args: { _code: string }; Returns: undefined }
      is_reserved_slug: { Args: { _slug: string }; Returns: boolean }
      mark_offline_rfid_devices: { Args: never; Returns: undefined }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      notify_admin_wa: {
        Args: { _event_type: string; _payload: Json }
        Returns: undefined
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      rfid_required_min_devices: {
        Args: { _school_id: string }
        Returns: number
      }
      slugify: { Args: { _input: string }; Returns: string }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "school_admin"
        | "staff"
        | "teacher"
        | "bendahara"
        | "principal"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "school_admin",
        "staff",
        "teacher",
        "bendahara",
        "principal",
      ],
    },
  },
} as const
