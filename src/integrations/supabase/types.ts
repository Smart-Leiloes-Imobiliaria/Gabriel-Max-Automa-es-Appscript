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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          details: Json | null
          id: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          agency_id: string
          channel: string
          id: string
          message: string
          related_id: string
          related_type: string
          sent_at: string
          status: string
        }
        Insert: {
          agency_id: string
          channel?: string
          id?: string
          message: string
          related_id: string
          related_type: string
          sent_at?: string
          status?: string
        }
        Update: {
          agency_id?: string
          channel?: string
          id?: string
          message?: string
          related_id?: string
          related_type?: string
          sent_at?: string
          status?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          agency_id: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          notary_office_name: string | null
          phone: string | null
          uf: string | null
        }
        Insert: {
          agency_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          is_active?: boolean
          notary_office_name?: string | null
          phone?: string | null
          uf?: string | null
        }
        Update: {
          agency_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          notary_office_name?: string | null
          phone?: string | null
          uf?: string | null
        }
        Relationships: []
      }
      property_treatments: {
        Row: {
          agency_id: string | null
          agency_name: string | null
          client_name: string
          contract_file_name: string | null
          contract_file_path: string | null
          created_at: string
          demand_status: string
          e_notariado_link: string | null
          id: string
          manager_contract_file_name: string | null
          manager_contract_file_path: string | null
          manager_contract_uploaded_at: string | null
          manager_minute_file_name: string | null
          manager_minute_file_path: string | null
          manager_validated: boolean | null
          manager_validated_at: string | null
          manager_validation_reason: string | null
          minute_file_name: string | null
          minute_file_path: string | null
          minute_sent_at: string
          minute_status: string
          notary_office_name: string | null
          observations: string | null
          owner_id: string | null
          property_code: string
          property_registration: string | null
          protocol: string
          signature_type: string | null
          uf: string
          updated_at: string
        }
        Insert: {
          agency_id?: string | null
          agency_name?: string | null
          client_name: string
          contract_file_name?: string | null
          contract_file_path?: string | null
          created_at?: string
          demand_status: string
          e_notariado_link?: string | null
          id?: string
          manager_contract_file_name?: string | null
          manager_contract_file_path?: string | null
          manager_contract_uploaded_at?: string | null
          manager_minute_file_name?: string | null
          manager_minute_file_path?: string | null
          manager_validated?: boolean | null
          manager_validated_at?: string | null
          manager_validation_reason?: string | null
          minute_file_name?: string | null
          minute_file_path?: string | null
          minute_sent_at: string
          minute_status?: string
          notary_office_name?: string | null
          observations?: string | null
          owner_id?: string | null
          property_code: string
          property_registration?: string | null
          protocol: string
          signature_type?: string | null
          uf: string
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          agency_name?: string | null
          client_name?: string
          contract_file_name?: string | null
          contract_file_path?: string | null
          created_at?: string
          demand_status?: string
          e_notariado_link?: string | null
          id?: string
          manager_contract_file_name?: string | null
          manager_contract_file_path?: string | null
          manager_contract_uploaded_at?: string | null
          manager_minute_file_name?: string | null
          manager_minute_file_path?: string | null
          manager_validated?: boolean | null
          manager_validated_at?: string | null
          manager_validation_reason?: string | null
          minute_file_name?: string | null
          minute_file_path?: string | null
          minute_sent_at?: string
          minute_status?: string
          notary_office_name?: string | null
          observations?: string | null
          owner_id?: string | null
          property_code?: string
          property_registration?: string | null
          protocol?: string
          signature_type?: string | null
          uf?: string
          updated_at?: string
        }
        Relationships: []
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
      video_conferences: {
        Row: {
          agency_id: string
          agency_name: string
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          client_cpf: string | null
          client_email: string | null
          client_email_error: string | null
          client_email_status: string | null
          client_name: string
          client_phone: string | null
          client_present: boolean
          client_whatsapp_error: string | null
          client_whatsapp_status: string | null
          completed_at: string | null
          conference_date: string
          conference_time: string
          created_at: string
          id: string
          manager_confirmed_at: string | null
          manager_confirmed_by: string | null
          meet_event_id: string | null
          meet_link: string | null
          meeting_type: string
          notary_office_name: string
          owner_id: string | null
          partner_confirmed_at: string | null
          partner_confirmed_by: string | null
          partner_responsible_name: string
          property_code: string
          property_registration: string | null
          property_state: string
          protocol: string
          status: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          agency_name: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_cpf?: string | null
          client_email?: string | null
          client_email_error?: string | null
          client_email_status?: string | null
          client_name: string
          client_phone?: string | null
          client_present?: boolean
          client_whatsapp_error?: string | null
          client_whatsapp_status?: string | null
          completed_at?: string | null
          conference_date: string
          conference_time: string
          created_at?: string
          id?: string
          manager_confirmed_at?: string | null
          manager_confirmed_by?: string | null
          meet_event_id?: string | null
          meet_link?: string | null
          meeting_type?: string
          notary_office_name: string
          owner_id?: string | null
          partner_confirmed_at?: string | null
          partner_confirmed_by?: string | null
          partner_responsible_name: string
          property_code: string
          property_registration?: string | null
          property_state: string
          protocol: string
          status?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          agency_name?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_cpf?: string | null
          client_email?: string | null
          client_email_error?: string | null
          client_email_status?: string | null
          client_name?: string
          client_phone?: string | null
          client_present?: boolean
          client_whatsapp_error?: string | null
          client_whatsapp_status?: string | null
          completed_at?: string | null
          conference_date?: string
          conference_time?: string
          created_at?: string
          id?: string
          manager_confirmed_at?: string | null
          manager_confirmed_by?: string | null
          meet_event_id?: string | null
          meet_link?: string | null
          meeting_type?: string
          notary_office_name?: string
          owner_id?: string | null
          partner_confirmed_at?: string | null
          partner_confirmed_by?: string | null
          partner_responsible_name?: string
          property_code?: string
          property_registration?: string | null
          property_state?: string
          protocol?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_exists: { Args: never; Returns: boolean }
      get_day_bookings: {
        Args: { _agency_id: string; _date: string }
        Returns: {
          conference_time: string
        }[]
      }
      get_schedule_by_protocol: {
        Args: { _protocol: string }
        Returns: {
          agency_id: string
          agency_name: string
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          client_cpf: string | null
          client_email: string | null
          client_email_error: string | null
          client_email_status: string | null
          client_name: string
          client_phone: string | null
          client_present: boolean
          client_whatsapp_error: string | null
          client_whatsapp_status: string | null
          completed_at: string | null
          conference_date: string
          conference_time: string
          created_at: string
          id: string
          manager_confirmed_at: string | null
          manager_confirmed_by: string | null
          meet_event_id: string | null
          meet_link: string | null
          meeting_type: string
          notary_office_name: string
          owner_id: string | null
          partner_confirmed_at: string | null
          partner_confirmed_by: string | null
          partner_responsible_name: string
          property_code: string
          property_registration: string | null
          property_state: string
          protocol: string
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "video_conferences"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_user_agency: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      next_protocol: { Args: { prefix: string }; Returns: string }
    }
    Enums: {
      app_role: "parceiro" | "gerente" | "admin" | "proprietario"
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
      app_role: ["parceiro", "gerente", "admin", "proprietario"],
    },
  },
} as const
