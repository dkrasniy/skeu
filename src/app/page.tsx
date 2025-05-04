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
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#">
                    Building Your Application
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Data Fetching</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <h1 className="text-2xl font-bold">Welcome to the Dashboard</h1>
          <ScreenshotEditor />
        </div>
      </SidebarInset>
    </SidebarProvider>

 
  );
}
