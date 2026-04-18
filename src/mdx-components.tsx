import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { Callout } from "@/components/mdx/Callout";
import { ImageZoom } from "@/components/image-zoom";
import { ParameterList } from "@/components/mdx/parameter-list";
import { YouTube } from "@/components/mdx/YouTube";
import * as TabsComponents from "fumadocs-ui/components/tabs";

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...components,
    ...TabsComponents,
    Callout,
    ParameterList,
    YouTube,
    img: ImageZoom,
  };
}
