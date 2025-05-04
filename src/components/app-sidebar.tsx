"use client"

import * as React from "react"
import {
  BookOpen,
  Bot,
  Command,
  Frame,
  Home,
  LifeBuoy,
  Map,
  PieChart,
  Send,
  Settings2,
  SquareTerminal,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Home",
      url: "#",
      icon: Home,
      isActive: true,
      
    },
    {
      title: "Models",
      url: "#",
      icon: Bot,
      
    },
    {
      title: "Documentation",
      url: "#",
      icon: BookOpen,
     
    },
    {
      title: "Settings",
      url: "#",
      icon: Settings2,
    
    },
  ],
  
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      {/* <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="#">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Command className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Acme Inc</span>
                  <span className="truncate text-xs">Enterprise</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader> */}
      <div className="flex items-center justify-center py-4">



<svg  className="size-10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M21 7.5L18.75 6.187M21 7.5V9.75M21 7.5L18.75 8.813M3 7.5L5.25 6.187M3 7.5L5.25 8.813M3 7.5V9.75M12 21.75L14.25 20.437M12 21.75V19.5M12 21.75L9.75 20.437M9.75 3.562L12 2.25L14.25 3.563M21 14.25V16.5L18.75 17.813M5.25 17.813L3 16.5V14.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
<path d="M11.2617 10.6758C11.2617 10.8359 11.3633 10.9766 11.5664 11.0977C11.7695 11.2148 11.9844 11.3281 12.2109 11.4375C12.4883 11.5703 12.7559 11.7168 13.0137 11.877C13.2715 12.0371 13.4824 12.2285 13.6465 12.4512C13.8145 12.6738 13.8984 12.9531 13.8984 13.2891C13.8984 13.5156 13.8652 13.7227 13.7988 13.9102C13.6582 14.2617 13.4355 14.5254 13.1309 14.7012C13.0566 14.7441 12.9785 14.7832 12.8965 14.8184C12.8184 14.8496 12.7383 14.8789 12.6562 14.9062C12.4883 14.957 12.3184 14.9922 12.1465 15.0117C11.9746 15.0352 11.8125 15.0469 11.6602 15.0469C11.3516 15.0469 11.0898 15.0215 10.875 14.9707C10.6523 14.9199 10.4609 14.8535 10.3008 14.7715C10.1406 14.6855 10.0098 14.5879 9.9082 14.4785C9.76367 14.3301 9.66016 14.166 9.59766 13.9863C9.53516 13.8066 9.50391 13.6367 9.50391 13.4766C9.50391 13.0234 9.76953 12.7969 10.3008 12.7969C10.4961 12.7969 10.6562 12.8496 10.7812 12.9551C10.9062 13.0605 10.9727 13.2305 10.9805 13.4648C10.9883 13.6133 11.0625 13.7129 11.2031 13.7637C11.3438 13.8145 11.4922 13.8398 11.6484 13.8398C11.8008 13.8398 11.9238 13.8008 12.0176 13.7227C12.1152 13.6406 12.1641 13.5352 12.1641 13.4062C12.1641 13.2539 12.1074 13.1172 11.9941 12.9961C11.8809 12.875 11.7363 12.7637 11.5605 12.6621C11.3887 12.5605 11.2148 12.4609 11.0391 12.3633C10.7969 12.2344 10.5605 12.0957 10.3301 11.9473C10.0996 11.7949 9.91016 11.6211 9.76172 11.4258C9.61328 11.2266 9.53906 10.9922 9.53906 10.7227C9.53906 10.418 9.58789 10.1641 9.68555 9.96094C9.78711 9.75391 9.93359 9.58594 10.125 9.45703C10.3164 9.33203 10.5488 9.24219 10.8223 9.1875C11.0996 9.13281 11.4141 9.10156 11.7656 9.09375H11.8594C12.168 9.09375 12.4375 9.12109 12.668 9.17578C12.8867 9.23047 13.0684 9.30273 13.2129 9.39258C13.3613 9.47852 13.4785 9.57617 13.5645 9.68555C13.6816 9.83789 13.7559 9.99414 13.7871 10.1543C13.8223 10.3105 13.8398 10.457 13.8398 10.5938C13.8398 10.8242 13.7539 10.9805 13.582 11.0625C13.4141 11.1406 13.2148 11.1836 12.9844 11.1914C12.8125 11.1914 12.666 11.1406 12.5449 11.0391C12.4238 10.9336 12.3633 10.8203 12.3633 10.6992C12.3555 10.5508 12.2949 10.4375 12.1816 10.3594C12.0723 10.2812 11.9375 10.2422 11.7773 10.2422C11.6367 10.2422 11.5156 10.2754 11.4141 10.3418C11.3125 10.4043 11.2617 10.5156 11.2617 10.6758Z" fill="currentColor"/>
</svg>


</div>
      <SidebarContent>
        <NavMain items={data.navMain} />
       
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
