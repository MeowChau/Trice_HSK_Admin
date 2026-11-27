"use client";
import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSidebar } from "../context/SidebarContext";
import {
  ShootingStarIcon,
  FolderIcon,
  ChevronDownIcon,
  GridIcon,
  DollarLineIcon,
  HorizontaLDots,
  ListIcon,
  PageIcon,
  TableIcon,
  TimeIcon,
  UserCircleIcon,
  GroupIcon,
} from "../icons/index";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { name: string; path: string; pro?: boolean; new?: boolean }[];
};

const navItems: NavItem[] = [
  {
    icon: <GridIcon />,
    name: "Tổng quan",
    path: "/",
  },
  {
    name: "Học viên",
    icon: <GroupIcon />,
    subItems: [
      { name: "Danh sách tài khoản", path: "/students", pro: false },
      { name: "Học viên chờ duyệt", path: "/students/pending", pro: false },
    ],
  },
  {
    name: "Giáo viên",
    icon: <UserCircleIcon />,
    subItems: [
      { name: "Danh sách giáo viên", path: "/teachers", pro: false },
      { name: "Thống kê giáo viên", path: "/teachers/stats", pro: false },
    ],
  },
  {
    name: "Ngân hàng câu hỏi",
    icon: <ListIcon />,
    subItems: [
      { name: "Danh sách câu hỏi", path: "/questions", pro: false },
      { name: "Thêm câu hỏi", path: "/questions/create", pro: false },
      { name: "Danh sách đề thi", path: "/exams", pro: false },
      { name: "Thêm đề thi", path: "/exams/create", pro: false },
    ],
  },
  {
    name: "Quản lý dữ liệu",
    icon: <FolderIcon />,
    subItems: [
      { name: "Từ vựng", path: "/data/vocabulary", pro: false },
      { name: "Nghe", path: "/data/listening", pro: false },
      { name: "Nói", path: "/data/speaking", pro: false },
      { name: "Đọc", path: "/data/reading", pro: false },
      { name: "Viết", path: "/data/writing", pro: false },
      { name: "Các chủ đề bài học", path: "/data/topics", pro: false },
    ],
  },
  {
    name: "Bảng xếp hạng",
    icon: <ShootingStarIcon />,
    subItems: [
      { name: "Chuỗi ngày", path: "/leaderboard/streak", pro: false },
      { name: "Đề thi", path: "/leaderboard/exam", pro: false },
      { name: "Game online", path: "/leaderboard/game", pro: false },
    ],
  },
  {
    icon: <DollarLineIcon />,
    name: "Doanh thu",
    path: "/revenue",
  },
  {
    name: "Truy vết chỉnh sửa",
    icon: <TimeIcon />,
    path: "/audit-logs",
  },
  {
    name: "Bảng dữ liệu",
    icon: <TableIcon />,
    subItems: [{ name: "Bảng cơ bản", path: "/basic-tables", pro: false }],
  },
  {
    name: "Trang",
    icon: <PageIcon />,
    subItems: [
      { name: "Trang trống", path: "/blank", pro: false },
      { name: "Lỗi 404", path: "/error-404", pro: false },
    ],
  },
];

const paths = navItems.flatMap(
  (item) => item.subItems?.map((sub) => sub.path) ?? (item.path ? [item.path] : []),
);

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();

  const renderMenuItems = () => (
    <ul className="flex flex-col gap-4">
      {navItems.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index)}
              className={`menu-item group  ${
                openSubmenu === index
                  ? "menu-item-active"
                  : "menu-item-inactive"
              } cursor-pointer ${
                !isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "lg:justify-start"
              }`}
            >
              <span
                className={` ${
                  openSubmenu === index
                    ? "menu-item-icon-active"
                    : "menu-item-icon-inactive"
                }`}
              >
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && (
                <span className={`menu-item-text`}>{nav.name}</span>
              )}
              {(isExpanded || isHovered || isMobileOpen) && (
                <ChevronDownIcon
                  className={`ml-auto w-5 h-5 transition-transform duration-200  ${
                    openSubmenu === index
                      ? "rotate-180 text-brand-500"
                      : ""
                  }`}
                />
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                href={nav.path}
                className={`menu-item group ${
                  isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                }`}
              >
                <span
                  className={`${
                    isActive(nav.path)
                      ? "menu-item-icon-active"
                      : "menu-item-icon-inactive"
                  }`}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className={`menu-item-text`}>{nav.name}</span>
                )}
              </Link>
            )
          )}
          {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
            <div
              className={`grid transition-[grid-template-rows] duration-300 ${openSubmenu === index ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
            >
              <div className="min-h-0 overflow-hidden">
                <ul className="mt-2 space-y-1 ml-9">
                  {nav.subItems.map((subItem) => (
                    <li key={subItem.name}>
                      <Link
                        href={subItem.path}
                        className={`menu-dropdown-item ${
                          isActive(subItem.path)
                            ? "menu-dropdown-item-active"
                            : "menu-dropdown-item-inactive"
                        }`}
                      >
                        {subItem.name}
                        <span className="flex items-center gap-1 ml-auto">
                          {subItem.new && (
                            <span
                              className={`ml-auto ${
                                isActive(subItem.path)
                                  ? "menu-dropdown-badge-active"
                                  : "menu-dropdown-badge-inactive"
                              } menu-dropdown-badge `}
                            >
                              new
                            </span>
                          )}
                          {subItem.pro && (
                            <span
                              className={`ml-auto ${
                                isActive(subItem.path)
                                  ? "menu-dropdown-badge-active"
                                  : "menu-dropdown-badge-inactive"
                              } menu-dropdown-badge `}
                            >
                              pro
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  const [clickedSubmenu, setClickedSubmenu] = useState<{
    pathname: string;
    index: number;
  } | null>(null);
  const isActive = (path: string) =>
    pathname === path ||
    (path !== "/" &&
      pathname.startsWith(`${path}/`) &&
      !paths.includes(pathname));
  const routeSubmenu = navItems.findIndex((item) =>
    item.subItems?.some((sub) => isActive(sub.path)),
  );
  const openSubmenu =
    clickedSubmenu?.pathname === pathname ? clickedSubmenu.index : routeSubmenu;
  const handleSubmenuToggle = (index: number) => {
    setClickedSubmenu({
      pathname,
      index: openSubmenu === index ? -1 : index,
    });
  };

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 
        ${
          isExpanded || isMobileOpen
            ? "w-[290px]"
            : isHovered
              ? "w-[290px]"
              : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`py-8 flex  ${
          !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
        }`}
      >
        <Link href="/" className="flex items-center gap-3">
          {isExpanded || isHovered || isMobileOpen ? (
            <>
              <Image
                src="/images/logo/logo-nobg.png"
                alt="Logo"
                width={40}
                height={40}
              />
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                TriceHSK
              </span>
            </>
          ) : (
            <Image
              src="/images/logo/logo-nobg.png"
              alt="Logo"
              width={32}
              height={32}
            />
          )}
        </Link>
      </div>
      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <h2
            className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
              !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
            }`}
          >
            {isExpanded || isHovered || isMobileOpen ? "Danh mục" : <HorizontaLDots />}
          </h2>
          {renderMenuItems()}
        </nav>
      </div>
    </aside>
  );
};

export default AppSidebar;
