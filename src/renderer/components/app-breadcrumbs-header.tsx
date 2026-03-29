/*
Назначение: Отрисовывает header внутри SidebarInset с триггером сайдбара и хлебными крошками приложения.
Не входит: Формирование breadcrumb-цепочки, логика переходов по страницам и содержимое основного workspace.
*/
import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "@/renderer/components/ui/breadcrumb";
import { Separator } from "@/renderer/components/ui/separator";
import { SidebarTrigger } from "@/renderer/components/ui/sidebar";
import { useAppBreadcrumbs } from "@/renderer/features/navigation/use-app-breadcrumbs";

export function AppBreadcrumbsHeader() {
  const items = useAppBreadcrumbs();

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            const visibilityClassName = item.hideOnMobile ? "hidden md:block" : undefined;

            return (
              <Fragment key={item.id}>
                <BreadcrumbItem className={visibilityClassName}>
                  {isLast || !item.onClick ? (
                    <BreadcrumbPage>{item.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <button type="button" onClick={item.onClick} className="cursor-pointer">
                        {item.label}
                      </button>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {isLast ? null : <BreadcrumbSeparator className={visibilityClassName} />}
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  );
}
