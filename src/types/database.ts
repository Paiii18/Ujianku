
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "academic_years": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"name": string,"semester": number,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"semester": number,"tenant_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"semester"?: number,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "academic_years_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"id": number,"new_value": Json | null,"old_value": Json | null,"record_id": string | null,"tenant_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"id"?: never,"new_value"?: Json | null,"old_value"?: Json | null,"record_id"?: string | null,"tenant_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"id"?: never,"new_value"?: Json | null,"old_value"?: Json | null,"record_id"?: string | null,"tenant_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_logs_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"class_students": {
                  Row: {
                    "academic_year_id": string,"class_id": string,"created_at": string,"student_id": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "academic_year_id": string,"class_id": string,"created_at"?: string,"student_id": string,"tenant_id"?: string
                  }
                  Update: {
                    "academic_year_id"?: string,"class_id"?: string,"created_at"?: string,"student_id"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_students_class_id_academic_year_id_tenant_id_fkey"
      columns: ["class_id","academic_year_id","tenant_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["id","academic_year_id","tenant_id"]
    },{
      foreignKeyName: "class_students_student_id_tenant_id_fkey"
      columns: ["student_id","tenant_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id","tenant_id"]
    }
                  ]
                },"classes": {
                  Row: {
                    "academic_year_id": string,"created_at": string,"grade_level": number,"homeroom_teacher_id": string | null,"id": string,"name": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "academic_year_id": string,"created_at"?: string,"grade_level": number,"homeroom_teacher_id"?: string | null,"id"?: string,"name": string,"tenant_id"?: string
                  }
                  Update: {
                    "academic_year_id"?: string,"created_at"?: string,"grade_level"?: number,"homeroom_teacher_id"?: string | null,"id"?: string,"name"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "classes_academic_year_id_tenant_id_fkey"
      columns: ["academic_year_id","tenant_id"]
isOneToOne: false
      referencedRelation: "academic_years"
      referencedColumns: ["id","tenant_id"]
    },{
      foreignKeyName: "classes_homeroom_teacher_id_tenant_id_fkey"
      columns: ["homeroom_teacher_id","tenant_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id","tenant_id"]
    },{
      foreignKeyName: "classes_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"import_jobs": {
                  Row: {
                    "created_at": string,"errors": NonNullable<Json>,"file_name": string,"finished_at": string | null,"id": string,"imported_count": number,"status": Database["public"]['Enums']["import_status"],"tenant_id": string,"total_rows": number,"uploaded_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"errors"?: NonNullable<Json>,"file_name": string,"finished_at"?: string | null,"id"?: string,"imported_count"?: number,"status"?: Database["public"]['Enums']["import_status"],"tenant_id"?: string,"total_rows"?: number,"uploaded_by"?: string
                  }
                  Update: {
                    "created_at"?: string,"errors"?: NonNullable<Json>,"file_name"?: string,"finished_at"?: string | null,"id"?: string,"imported_count"?: number,"status"?: Database["public"]['Enums']["import_status"],"tenant_id"?: string,"total_rows"?: number,"uploaded_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "import_jobs_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "import_jobs_uploaded_by_tenant_id_fkey"
      columns: ["uploaded_by","tenant_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id","tenant_id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"created_at": string,"dedup_key": string | null,"id": string,"link": string | null,"read_at": string | null,"tenant_id": string | null,"title": string,"type": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"dedup_key"?: string | null,"id"?: string,"link"?: string | null,"read_at"?: string | null,"tenant_id"?: string | null,"title": string,"type": string,"user_id": string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"dedup_key"?: string | null,"id"?: string,"link"?: string | null,"read_at"?: string | null,"tenant_id"?: string | null,"title"?: string,"type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"full_name": string,"id": string,"is_active": boolean,"nis_nip": string | null,"role": Database["public"]['Enums']["user_role"],"tenant_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"full_name": string,"id": string,"is_active"?: boolean,"nis_nip"?: string | null,"role": Database["public"]['Enums']["user_role"],"tenant_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"full_name"?: string,"id"?: string,"is_active"?: boolean,"nis_nip"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"tenant_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"question_options": {
                  Row: {
                    "content": string,"id": string,"image_path": string | null,"is_correct": boolean,"label": string,"question_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content"?: string,"id"?: string,"image_path"?: string | null,"is_correct"?: boolean,"label": string,"question_id": string
                  }
                  Update: {
                    "content"?: string,"id"?: string,"image_path"?: string | null,"is_correct"?: boolean,"label"?: string,"question_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_options_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    }
                  ]
                },"question_pairs": {
                  Row: {
                    "id": string,"left_text": string,"position": number,"question_id": string,"right_key": string,"right_text": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"left_text": string,"position"?: number,"question_id": string,"right_key"?: string,"right_text": string
                  }
                  Update: {
                    "id"?: string,"left_text"?: string,"position"?: number,"question_id"?: string,"right_key"?: string,"right_text"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_pairs_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    }
                  ]
                },"questions": {
                  Row: {
                    "accepted_answers": (string)[] | null,"answer_key": string | null,"content": string,"created_at": string,"created_by": string,"explanation": string | null,"id": string,"image_path": string | null,"keywords": (string)[] | null,"parent_id": string | null,"points": number,"position": number,"subject_id": string,"tenant_id": string,"type": Database["public"]['Enums']["question_type"]
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_answers"?: (string)[] | null,"answer_key"?: string | null,"content": string,"created_at"?: string,"created_by"?: string,"explanation"?: string | null,"id"?: string,"image_path"?: string | null,"keywords"?: (string)[] | null,"parent_id"?: string | null,"points"?: number,"position"?: number,"subject_id": string,"tenant_id"?: string,"type": Database["public"]['Enums']["question_type"]
                  }
                  Update: {
                    "accepted_answers"?: (string)[] | null,"answer_key"?: string | null,"content"?: string,"created_at"?: string,"created_by"?: string,"explanation"?: string | null,"id"?: string,"image_path"?: string | null,"keywords"?: (string)[] | null,"parent_id"?: string | null,"points"?: number,"position"?: number,"subject_id"?: string,"tenant_id"?: string,"type"?: Database["public"]['Enums']["question_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "questions_created_by_tenant_id_fkey"
      columns: ["created_by","tenant_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id","tenant_id"]
    },{
      foreignKeyName: "questions_parent_id_tenant_id_fkey"
      columns: ["parent_id","tenant_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id","tenant_id"]
    },{
      foreignKeyName: "questions_subject_id_tenant_id_fkey"
      columns: ["subject_id","tenant_id"]
isOneToOne: false
      referencedRelation: "subjects"
      referencedColumns: ["id","tenant_id"]
    },{
      foreignKeyName: "questions_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"subjects": {
                  Row: {
                    "code": string,"created_at": string,"id": string,"name": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"id"?: string,"name": string,"tenant_id"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"id"?: string,"name"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subjects_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"subscriptions": {
                  Row: {
                    "amount": number,"created_at": string,"id": string,"paid_at": string | null,"period_end": string | null,"period_start": string | null,"status": Database["public"]['Enums']["payment_status"],"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"id"?: string,"paid_at"?: string | null,"period_end"?: string | null,"period_start"?: string | null,"status"?: Database["public"]['Enums']["payment_status"],"tenant_id": string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"id"?: string,"paid_at"?: string | null,"period_end"?: string | null,"period_start"?: string | null,"status"?: Database["public"]['Enums']["payment_status"],"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"teaching_assignments": {
                  Row: {
                    "class_id": string,"created_at": string,"id": string,"subject_id": string,"teacher_id": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "class_id": string,"created_at"?: string,"id"?: string,"subject_id": string,"teacher_id": string,"tenant_id"?: string
                  }
                  Update: {
                    "class_id"?: string,"created_at"?: string,"id"?: string,"subject_id"?: string,"teacher_id"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "teaching_assignments_class_id_tenant_id_fkey"
      columns: ["class_id","tenant_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["id","tenant_id"]
    },{
      foreignKeyName: "teaching_assignments_subject_id_tenant_id_fkey"
      columns: ["subject_id","tenant_id"]
isOneToOne: false
      referencedRelation: "subjects"
      referencedColumns: ["id","tenant_id"]
    },{
      foreignKeyName: "teaching_assignments_teacher_id_tenant_id_fkey"
      columns: ["teacher_id","tenant_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id","tenant_id"]
    },{
      foreignKeyName: "teaching_assignments_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"tenants": {
                  Row: {
                    "active_until": string | null,"code": string,"created_at": string,"id": string,"name": string,"status": Database["public"]['Enums']["tenant_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "active_until"?: string | null,"code": string,"created_at"?: string,"id"?: string,"name": string,"status"?: Database["public"]['Enums']["tenant_status"]
                  }
                  Update: {
                    "active_until"?: string | null,"code"?: string,"created_at"?: string,"id"?: string,"name"?: string,"status"?: Database["public"]['Enums']["tenant_status"]
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "activate_academic_year":
{ Args: { "p_id": string }; Returns: undefined
                           },
"create_school":
{ Args: { "p_admin_id": string,"p_admin_name": string,"p_code": string,"p_name": string }; Returns: string
                           },
"create_school_user":
{ Args: { "p_full_name": string,"p_id": string,"p_nis_nip": string,"p_role": Database["public"]['Enums']["user_role"] }; Returns: undefined
                           },
"import_students":
{ Args: { "p_rows": Json }; Returns: number
                           },
"is_super_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"managed_user_role":
{ Args: { "p_id": string }; Returns: Database["public"]['Enums']["user_role"]
                           },
"mark_payment_paid":
{ Args: { "p_subscription_id": string }; Returns: string
                           },
"my_access":
{ Args: Record<PropertyKey, never>; Returns: {
              "is_active": boolean,"role": Database["public"]['Enums']["user_role"],"tenant_active": boolean
            }[]
                           },
"my_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["user_role"]
                           },
"my_school":
{ Args: Record<PropertyKey, never>; Returns: {
              "active_until": string,"code": string,"name": string
            }[]
                           },
"my_tenant":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"run_subscription_check":
{ Args: { "p_now"?: string }; Returns: {
              "deactivated": number,"notified": number
            }[]
                           },
"save_question":
{ Args: { "p_content": string,"p_explanation": string,"p_id": string,"p_image_path": string,"p_options": Json,"p_points": number,"p_subject_id": string,"p_type": Database["public"]['Enums']["question_type"] }; Returns: string
                           },
"set_school_user_active":
{ Args: { "p_active": boolean,"p_id": string }; Returns: undefined
                           },
"students_without_class":
{ Args: { "p_academic_year_id": string,"p_q"?: string }; Returns: {
              "full_name": string,"id": string,"nis_nip": string
            }[]
                           },
"teacher_emails":
{ Args: Record<PropertyKey, never>; Returns: {
              "email": string,"id": string
            }[]
                           },
"tenant_is_active":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"update_school_user":
{ Args: { "p_full_name": string,"p_id": string,"p_nip": string }; Returns: undefined
                           }
          }
          Enums: {
            "import_status": "processing"|"success"|"failed","payment_status": "pending"|"paid"|"cancelled","question_type": "multiple_choice"|"true_false"|"short_answer"|"matching"|"essay"|"multi_essay","tenant_status": "active"|"inactive","user_role": "super_admin"|"school_admin"|"teacher"|"student"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "import_status": ["processing", "success", "failed"],"payment_status": ["pending", "paid", "cancelled"],"question_type": ["multiple_choice", "true_false", "short_answer", "matching", "essay", "multi_essay"],"tenant_status": ["active", "inactive"],"user_role": ["super_admin", "school_admin", "teacher", "student"]
          }
        }
} as const
