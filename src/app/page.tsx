import Image from "next/image";
import { redirect } from 'next/navigation' 
import { createClient } from '@/lib/supabase/server'
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { SidebarInset } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/app-sidebar";
import { ScreenshotEditor } from '@/components/screenshot-editor/ScreenshotEditor';
import Logo from "@/components/logo";

export default async function Home() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()

  //fetch user data from supabase from users table 
  const { data: userData, error: userError } = await supabase.from('users').select('full_name').eq('id', data?.user?.id)
 

  return (
    <SidebarProvider>
      {/* <AppSidebar />
      <SidebarInset> */} 
 
        <div className="flex flex-1 flex-col gap-4 pt-4  font-sans">
        <Logo className="w-full h-8 text-neutral-600"/>
        <div className="flex flex-col items-center justify-center h-screen sm:hidden">
          <h1 className="text-2xl font-bold">This is not supported on small screens</h1>
        </div>
 
      
          <ScreenshotEditor  userData={data.user}/>
        </div>
      {/* </SidebarInset> */}
    </SidebarProvider>

 
  );
}
