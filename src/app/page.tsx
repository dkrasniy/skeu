import Image from "next/image";
import { redirect } from 'next/navigation' 
import { createClient } from '@/lib/supabase/server'
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { SidebarInset } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/app-sidebar";
import { ScreenshotEditor } from '@/components/screenshot-editor/ScreenshotEditor';

export default async function Home() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()

  //fetch user data from supabase from users table 
  const { data: userData, error: userError } = await supabase.from('users').select('full_name').eq('id', data?.user?.id)
 

  return (
    <SidebarProvider>
      {/* <AppSidebar />
      <SidebarInset> */} 
        <div className="flex flex-1 flex-col gap-4   font-sans">
        
          <ScreenshotEditor />
        </div>
      {/* </SidebarInset> */}
    </SidebarProvider>

 
  );
}
