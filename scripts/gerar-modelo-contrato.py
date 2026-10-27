# Gera public/modelos/contrato-bra.docx — o modelo Word padrão do Núcleo,
# recriado a partir do contrato "Jangadinha Campinas" (mesmo texto e estilo).
#
# Os campos variáveis ficam entre chaves, no formato do docxtemplater:
#   {numero} {unidade} {cliente_nome} {cliente_documento} {cliente_endereco}
#   {valor_total} {forma_recebimento} {cidade} {data}
#   {rep_nome} {rep_cpf} {rep_rg} {rep_endereco}  (representante legal)
#   {bra_nome} {bra_cpf}                          (quem assina pela BRA)
#   tabela de pagamento: linha com {#condicoes}{condicao} | {valor} | {vencimento}{/condicoes}
# Âncoras de assinatura do DocuSign (texto branco, invisível):
#   /ass_cliente/  /ass_bra/  /ass_rep/
#
# Uso: python3 scripts/gerar-modelo-contrato.py
from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_TAB_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

AQUI = __file__.rsplit("/", 1)[0]
SAIDA = AQUI + "/../public/modelos/contrato-bra.docx"

TEXTO = RGBColor(0x3A, 0x3A, 0x3A)
MARINHO = RGBColor(0x16, 0x23, 0x3F)
OURO = RGBColor(0xB8, 0x91, 0x2F)
CINZA = RGBColor(0x80, 0x80, 0x80)
BRANCO = RGBColor(0xFF, 0xFF, 0xFF)
OURO_LINHA = "C9B77E"

doc = Document()
st = doc.styles["Normal"]
st.font.name = "Calibri"
st.font.size = Pt(10.5)
st.font.color.rgb = TEXTO
st.element.rPr.rFonts.set(qn("w:eastAsia"), "Calibri")
st.paragraph_format.space_after = Pt(8)
st.paragraph_format.line_spacing = 1.2

sec = doc.sections[0]
sec.page_height, sec.page_width = Cm(29.7), Cm(21)
sec.left_margin = sec.right_margin = Cm(2.2)
sec.top_margin, sec.bottom_margin = Cm(2.3), Cm(2.2)
sec.header_distance = sec.footer_distance = Cm(1.1)
sec.different_first_page_header_footer = True


def borda(p, lado="bottom", cor=OURO_LINHA, tam=8, espaco=4):
    pPr = p._p.get_or_add_pPr()
    bdr = pPr.find(qn("w:pBdr"))
    if bdr is None:
        bdr = OxmlElement("w:pBdr")
        pPr.append(bdr)
    e = OxmlElement(f"w:{lado}")
    e.set(qn("w:val"), "single")
    e.set(qn("w:sz"), str(tam))
    e.set(qn("w:space"), str(espaco))
    e.set(qn("w:color"), cor)
    bdr.append(e)


def run(p, texto, negrito=False, italico=False, cor=None, tam=None, fonte=None, campo=False):
    r = p.add_run(texto)
    r.bold = negrito or campo
    r.italic = italico or campo
    if campo:
        r.font.color.rgb = OURO
    elif cor is not None:
        r.font.color.rgb = cor
    if tam:
        r.font.size = Pt(tam)
    if fonte:
        r.font.name = fonte
        r._element.rPr.rFonts.set(qn("w:hAnsi"), fonte)
    return r


def par(*partes, alinhar=WD_ALIGN_PARAGRAPH.JUSTIFY, depois=None, antes=None, recuo=None):
    """partes: str (texto normal) | (texto, dict de estilo)."""
    p = doc.add_paragraph()
    p.alignment = alinhar
    if depois is not None:
        p.paragraph_format.space_after = Pt(depois)
    if antes is not None:
        p.paragraph_format.space_before = Pt(antes)
    if recuo is not None:
        p.paragraph_format.left_indent = Cm(recuo)
    for x in partes:
        if isinstance(x, str):
            run(p, x)
        else:
            run(p, x[0], **x[1])
    return p


B = {"negrito": True}
C = {"campo": True}


def titulo(t):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(16)
    p.paragraph_format.space_after = Pt(10)
    p.paragraph_format.keep_with_next = True
    run(p, t, negrito=True, cor=MARINHO, tam=13, fonte="Cambria")
    borda(p, espaco=3)


def subtitulo(t):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.keep_with_next = True
    run(p, t, negrito=True, cor=MARINHO, tam=11, fonte="Cambria")


def marcador(t):
    p = doc.add_paragraph(style="List Bullet")
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.left_indent = Cm(1.0)
    run(p, t)


def alinea(letra, t):
    p = par((letra + ") ", B), t, recuo=0.6)
    return p


def sombrear(celula, cor):
    tcPr = celula._tc.get_or_add_tcPr()
    s = OxmlElement("w:shd")
    s.set(qn("w:val"), "clear")
    s.set(qn("w:color"), "auto")
    s.set(qn("w:fill"), cor)
    tcPr.append(s)


def tabela(cabecalho, linhas, larguras):
    t = doc.add_table(rows=1, cols=len(cabecalho))
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, h in enumerate(cabecalho):
        c = t.rows[0].cells[i]
        sombrear(c, "16233F")
        c.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
        run(c.paragraphs[0], h, negrito=True, cor=BRANCO, tam=9.5)
    for ln in linhas:
        cs = t.add_row().cells
        for i, v in enumerate(ln):
            p = cs[i].paragraphs[0]
            p.paragraph_format.space_after = Pt(1)
            if isinstance(v, str):
                run(p, v, tam=9.5)
            else:
                for x in v:
                    run(p, x[0], tam=9.5, **x[1])
    t.autofit = False
    grid = t._tbl.tblGrid
    for i, gc in enumerate(grid.findall(qn("w:gridCol"))):
        gc.set(qn("w:w"), str(int(larguras[i] * 567)))
    for ln in t.rows:
        for i, w in enumerate(larguras):
            ln.cells[i].width = Cm(w)
    # repete o cabeçalho em cada página
    trPr = t.rows[0]._tr.get_or_add_trPr()
    th = OxmlElement("w:tblHeader"); th.set(qn("w:val"), "true"); trPr.append(th)
    return t


def ancora(p, texto):
    r = run(p, texto, cor=BRANCO, tam=6)
    return r


# ---------------------------------------------------------------- cabeçalho/rodapé
def campo_pagina(p, instr):
    r = p.add_run()
    for tipo, txt in (("begin", None), (None, instr), ("separate", None), (None, "1"), ("end", None)):
        if tipo:
            f = OxmlElement("w:fldChar")
            f.set(qn("w:fldCharType"), tipo)
            r._r.append(f)
        elif txt == "1":
            t = OxmlElement("w:t")
            t.text = "1"
            r._r.append(t)
        else:
            i = OxmlElement("w:instrText")
            i.set(qn("xml:space"), "preserve")
            i.text = f" {txt} "
            r._r.append(i)
    r.font.size = Pt(7.5)
    r.font.color.rgb = CINZA


h = sec.header.paragraphs[0]
h.style.paragraph_format.tab_stops.clear_all()
h.paragraph_format.tab_stops.add_tab_stop(Cm(16.6), alignment=WD_TAB_ALIGNMENT.RIGHT)
run(h, "BRA AMBIENTES", negrito=True, cor=MARINHO, tam=9, fonte="Cambria")
run(h, "\tContrato {numero}", cor=CINZA, tam=8)
borda(h, cor=OURO_LINHA, tam=6, espaco=6)

f = sec.footer.paragraphs[0]
f.alignment = WD_ALIGN_PARAGRAPH.CENTER
f.paragraph_format.space_after = Pt(0)
borda_sup = f
pPr = f._p.get_or_add_pPr()
borda(f, lado="top", cor=OURO_LINHA, tam=6, espaco=6)
run(f, "BRTELECOM COMÉRCIO E SERVIÇOS INTEGRADOS LTDA | www.grupobrtelecom.com.br | www.braambientes.com.br", cor=CINZA, tam=7.5)
f2 = sec.footer.add_paragraph()
f2.alignment = WD_ALIGN_PARAGRAPH.CENTER
run(f2, "Página ", cor=CINZA, tam=7.5)
campo_pagina(f2, "PAGE")
run(f2, " de ", cor=CINZA, tam=7.5)
campo_pagina(f2, "NUMPAGES")

# ---------------------------------------------------------------- capa
logos = doc.add_table(rows=1, cols=2)
logos.alignment = WD_TABLE_ALIGNMENT.CENTER
for i, (arq, larg) in enumerate((("logo-bra.png", 4.6), ("logo-brt.png", 3.4))):
    p = logos.rows[0].cells[i].paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(30)
    p.add_run().add_picture(f"{AQUI}/modelo/{arq}", width=Cm(larg))

par(("BRA AMBIENTES", {"negrito": True, "cor": MARINHO, "tam": 30, "fonte": "Cambria"}), alinhar=WD_ALIGN_PARAGRAPH.CENTER, antes=40, depois=0)
p = par(("G R U P O   B R T E L E C O M", {"cor": OURO, "tam": 9}), alinhar=WD_ALIGN_PARAGRAPH.CENTER, depois=40)
borda(p, cor=OURO_LINHA, tam=8, espaco=20)

par(("CONTRATO DE COMPRA, VENDA E INSTALAÇÃO DE SISTEMA", {"negrito": True, "cor": MARINHO, "tam": 17, "fonte": "Cambria"}),
    alinhar=WD_ALIGN_PARAGRAPH.CENTER, antes=30, depois=4)
par(("Automação Residencial · Sonorização Ambiente · Segurança Eletrônica · Rede Estruturada", {"italico": True, "cor": CINZA, "tam": 9.5}),
    alinhar=WD_ALIGN_PARAGRAPH.CENTER, depois=60)
par(("Contrato referente a unidade {unidade}", {"negrito": True, "cor": OURO, "tam": 10}), alinhar=WD_ALIGN_PARAGRAPH.CENTER, depois=110)
par(("Nº do Contrato: ", {"negrito": True, "cor": MARINHO}), ("{numero}", C), alinhar=WD_ALIGN_PARAGRAPH.CENTER, depois=2)
p = par(("Cliente: ", {"negrito": True, "cor": MARINHO}), ("{cliente_nome}", C), alinhar=WD_ALIGN_PARAGRAPH.CENTER)
p.add_run().add_break(WD_BREAK.PAGE)

# ---------------------------------------------------------------- I
titulo("I. DAS PARTES")
par(("FORNECEDORA: ", B), "Brtelecom Comércio e Serviços Integrados LTDA, pessoa jurídica de direito privado, sociedade empresária, "
    "inscrita sob o CNPJ 07.787.973/0001-61, com sede na Rua Nossa Senhora de Fátima, 166, Bairro Nova Paulínia, na cidade de "
    "Paulínia, Estado de São Paulo, CEP 13.140-313, doravante denominada, simplesmente, FORNECEDORA.")
par(("Representante legal: ", B), "{rep_nome}, empresário, inscrito no CPF sob o nº {rep_cpf}, portador do RG nº {rep_rg}, "
    "residente e domiciliado na {rep_endereco}.")
par(("CLIENTE:", B), depois=6)
par(("Nome completo: ", B), ("{cliente_nome}", C), depois=4)
par(("CPF/CNPJ: ", B), ("{cliente_documento}", C), depois=4)
par(("Endereço: ", B), ("{cliente_endereco}", C))
par("Doravante denominada, simplesmente, CLIENTE, quando referidas em conjunto FORNECEDORA e CLIENTE serão denominadas PARTES.")

# ---------------------------------------------------------------- II
titulo("II. DO OBJETO")
par("A FORNECEDORA se obriga a fornecer à CLIENTE os projetos de automação, sonorização ambiente, segurança eletrônica e rede "
    "estruturada cujas características encontram-se descritas neste instrumento e em seus anexos, doravante denominados, "
    "simplesmente, SISTEMA. A FORNECEDORA compromete-se, ainda, a elaborar o respectivo Projeto Executivo e a prestar os serviços "
    "de instalação e consultoria técnica necessários à sua implantação.")
subtitulo("II.I. Composição do Sistema")
par("O SISTEMA é composto pelos itens e quantidades especificados no(s) orçamento(s) anexo(s) a este contrato, com valores "
    "expressos em moeda corrente nacional, os quais servem de referência para a composição do preço final. Estão inclusos os "
    "serviços de instalação, configuração e os respectivos acessórios necessários à funcionalidade do SISTEMA. A proposta anexa "
    "relaciona a totalidade dos equipamentos e acessórios acordados com a CLIENTE.")
subtitulo("II.II. Itens Não Integrantes do Sistema")
marcador("Instalação de toda a tubulação (conduítes), fiação elétrica, caixas de parede 4x2 e/ou 4x4, fornecimento de pulsadores, "
         "tomadas e demais adequações civis e elétricas necessárias à instalação do SISTEMA.")
marcador("Fornecimento de equipamentos ativos e passivos e acessórios que não estejam relacionados na proposta anexa e que sejam "
         "necessários à conclusão do projeto, quando não contemplados neste contrato.")
marcador("Em situações de retrofit, eventuais cortes de acesso no gesso, bem como seu fechamento e pintura, ficam sob "
         "responsabilidade e às expensas da CLIENTE.")

# ---------------------------------------------------------------- III
titulo("III. DA FORMA DE PAGAMENTO")
par("O preço total de venda do SISTEMA, incluída a instalação, é de ", ("{valor_total}", C),
    ", já contabilizado eventual desconto concedido durante a negociação, a ser pago pela CLIENTE conforme condições abaixo:")
tabela(["Condição", "Valor", "Vencimento"],
       [[[("{#condicoes}{condicao}", {})], [("{valor}", C)], [("{vencimento}{/condicoes}", C)]]],
       [5.2, 5.2, 6.2])
par(("Forma de recebimento: ", {"cor": OURO}), ("{forma_recebimento}", {"negrito": True, "cor": OURO}), antes=6, alinhar=WD_ALIGN_PARAGRAPH.LEFT)

# ---------------------------------------------------------------- IV
titulo("IV. DO PRAZO DE ENTREGA")
par("A partir do momento em que a obra alcançar estágio de desenvolvimento que permita a devida instalação, a CLIENTE deverá "
    "solicitar, por escrito, à FORNECEDORA a instalação do SISTEMA. A FORNECEDORA acompanhará de perto o desenvolvimento da obra, "
    "procedendo à instalação dos equipamentos ao final de cada etapa concluída, e manterá a CLIENTE informada sobre as próximas "
    "etapas por meio de cronograma atualizado periodicamente.")
par(("Cronograma-base de atividades:", B), depois=4)
CRONO = [
    ("Elaboração de Projeto de Tubulação", "5 dias"),
    ("Elaboração de Projeto de Cabeamento", "5 dias após o término do Projeto de Tubulação"),
    ("Entrega da caixa do Quadro de Automação", "15 dias após apresentação dos projetos na obra e definição do local do Quadro"),
    ("Passagem do cabeamento de som ambiente", "4 dias após término da instalação da tubulação e infraestrutura"),
    ("Conferência da passagem de cabos de rede, pulsadores, ar-condicionado e antena Wi-Fi", "2 dias após término da passagem dos cabos"),
    ("Cortes das caixas de som do teto", "3 dias após 100% da instalação da iluminação de teto"),
    ("Conferência da iluminação para produção do Quadro de Automação", "2 dias após 90% da instalação da iluminação"),
    ("Instalação dos emissores de IR nos ares-condicionados", "2 dias após 90% da instalação da iluminação"),
    ("Produção do Quadro de Automação", "3 dias após conferência da iluminação"),
    ("Instalação do Quadro de Automação e montagem dos pulsadores", "4 dias após conferência da iluminação e produção do Quadro"),
    ("Instalação das caixas de som de teto", "1 dia após cortes no teto e ambientes limpos"),
    ("Instalação do rack de redes e equipamentos (câmeras, Wi-Fi, interfones, pontos de rede, amplificadores, controladora)",
     "10 dias após conferência da iluminação; link de internet a ser contratado pela CLIENTE"),
    ("Programação e ajustes finos dos equipamentos de automação", "3 dias após instalação dos equipamentos de rede"),
    ("Entrega e instruções de uso ao cliente", "1 dia após término das atividades anteriores"),
]
t = tabela(["#", "Etapa", "Prazo estimado"], [[str(i + 1), e, pz] for i, (e, pz) in enumerate(CRONO)], [0.9, 9.4, 6.3])
for ln in t.rows[1:]:
    ln.cells[0].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
par("O cronograma acima é referencial e será ajustado conforme o andamento efetivo da obra, mediante comunicação prévia à CLIENTE.", antes=6)

# ---------------------------------------------------------------- V
titulo("V. DA GARANTIA")
par("A garantia dos equipamentos eletrônicos integrantes do SISTEMA segue o prazo estabelecido pelo respectivo fabricante, sendo "
    "de 24 (vinte e quatro) meses o prazo padrão oferecido. A FORNECEDORA é responsável pela intermediação entre o fabricante e a "
    "CLIENTE, bem como pela garantia e pelo funcionamento dos equipamentos fornecidos.")
par("Estão excluídos da garantia os eventos decorrentes de ações da natureza (raios, vendavais, infiltração de água), uso de "
    "produtos de limpeza inadequados, curtos-circuitos ou manuseio e utilização incorretos do SISTEMA. A garantia será "
    "integralmente perdida caso haja intervenção técnica realizada por agente não autorizado pelo respectivo fabricante.")

# ---------------------------------------------------------------- VII
titulo("VII. DOS ITENS NÃO INCLUÍDOS NO PREÇO")
marcador("Caberá exclusivamente à CLIENTE, e às suas expensas, providenciar que o local de instalação esteja devidamente preparado "
         "para receber o SISTEMA, podendo suas condições ser previamente vistoriadas pela FORNECEDORA antes do início dos serviços.")
marcador("Equipamentos que não integrem o escopo contratado serão objeto de orçamento específico, a ser enviado à CLIENTE mediante solicitação.")

# ---------------------------------------------------------------- VIII
titulo("VIII. DA LEI GERAL DE PROTEÇÃO DE DADOS (LGPD)")
for l, t_ in zip("abcdefghi", [
    "Este contrato observa a Lei Geral de Proteção de Dados Pessoais, Lei nº 13.709/2018 (\"LGPD\").",
    "A CLIENTE, para efeitos da LGPD, é a Titular dos dados, pessoa natural a quem se referem os dados pessoais tratados.",
    "Os dados pessoais da CLIENTE, para efeitos da LGPD, correspondem a informações relacionadas a pessoa natural identificada neste instrumento.",
    "A FORNECEDORA, nos termos da LGPD, realizará o tratamento dos dados pessoais da CLIENTE, incluindo coleta, armazenamento e "
    "transmissão, conforme descrito no art. 5º, inciso X, da Lei.",
    "O tratamento dos dados pessoais tem finalidade legítima, restrita ao cumprimento das obrigações contratuais e ao exercício regular "
    "de direitos em processo judicial, administrativo ou arbitral, observados os princípios de adequação e transparência.",
    "Os dados pessoais da CLIENTE ficam armazenados em centro de dados localizado em território nacional, no endereço da FORNECEDORA.",
    "A FORNECEDORA garante à CLIENTE o cumprimento dos direitos do titular previstos no Capítulo III da LGPD, desde que não conflitem "
    "com obrigação legal a que esteja sujeita.",
    "A FORNECEDORA adotará controles e medidas de segurança da informação e governança compatíveis com as boas práticas de mercado no "
    "tratamento dos dados pessoais da titular.",
    "A CLIENTE autoriza a FORNECEDORA a coletar os dados pessoais necessários, por meio físico e/ou digital, ao cumprimento das "
    "obrigações contratuais e ao exercício regular de direitos em processo judicial, administrativo ou arbitral.",
]):
    alinea(l, t_)

# ---------------------------------------------------------------- IX
titulo("IX. DAS CLÁUSULAS GERAIS")
for l, t_ in zip("abcd", [
    "O presente contrato não poderá ser modificado ou aditado unilateralmente por qualquer das partes, em nenhuma circunstância.",
    "Sempre que possível, cada disposição deste contrato será interpretada de modo a ser eficaz e válida nos termos da legislação "
    "aplicável; caso uma ou mais obrigações aqui previstas venham a ser declaradas ineficazes, ilegais ou inexequíveis, tal fato não "
    "afetará a integridade, a eficácia ou a validade das demais disposições pactuadas.",
    "O presente contrato é ajustado de modo irretratável e irrevogável, ressalvadas as hipóteses aqui expressamente previstas, "
    "obrigando as partes e seus sucessores ao seu estrito e integral cumprimento. Eventual tolerância entre as partes quanto ao "
    "cumprimento deste contrato não constituirá novação, e a falta de exercício de qualquer direito aqui conferido não implicará "
    "renúncia, tácita ou expressa, ao direito não exercido.",
    "Este contrato, juntamente com os documentos e anexos nele expressamente referidos ou rubricados pelas partes, representa a "
    "integralidade do ajuste entre elas relativamente ao objeto contratado, substituindo toda e qualquer negociação, proposta, "
    "correspondência ou comunicação anterior, escrita ou verbal, relacionada ao mesmo objeto.",
]):
    alinea(l, t_)

# ---------------------------------------------------------------- X / XI
titulo("X. DO FORO")
par("As partes elegem o foro da comarca de Paulínia, Estado de São Paulo, para dirimir quaisquer questões decorrentes deste contrato, "
    "com renúncia a qualquer outro, por mais especial ou privilegiado que seja.")
par("As partes firmam o presente instrumento em 2 (duas) vias de igual teor e forma, para um só efeito, na presença das testemunhas abaixo.")
titulo("XI. DAS VISITAS TÉCNICAS")
par("Durante o prazo de garantia de ", ("12", C), " meses, as visitas técnicas relacionadas a falhas de equipamentos, ajustes de "
    "programação e suporte à execução das funcionalidades do SISTEMA não terão custo adicional para a CLIENTE.")

# ---------------------------------------------------------------- assinaturas
inicio_ass = len(doc.paragraphs)
par("{cidade}, ", ("{data}", C), ".", alinhar=WD_ALIGN_PARAGRAPH.CENTER, antes=24, depois=30)


def assinatura(anc, linhas, ultima=False):
    p = par(alinhar=WD_ALIGN_PARAGRAPH.CENTER, antes=26, depois=0)
    ancora(p, anc)
    p2 = par(alinhar=WD_ALIGN_PARAGRAPH.CENTER, depois=2)
    run(p2, "_" * 46, cor=OURO)
    for i, ln in enumerate(linhas):
        q = par(alinhar=WD_ALIGN_PARAGRAPH.CENTER, depois=0)
        for x in ln:
            run(q, x[0], tam=9, **x[1])
    q.paragraph_format.space_after = Pt(10)
    if ultima:
        q.paragraph_format.keep_with_next = False


def manter_juntos():
    # bloco de data + assinaturas nunca se separa entre páginas
    for p in doc.paragraphs[inicio_ass:]:
        p.paragraph_format.keep_with_next = True
        p.paragraph_format.keep_together = True
    doc.paragraphs[-1].paragraph_format.keep_with_next = False


assinatura("/ass_cliente/", [[("{cliente_nome}", {"negrito": True, "cor": OURO})], [("CPF/CNPJ: ", {"cor": CINZA}), ("{cliente_documento}", C)]])
assinatura("/ass_rep/", [[("{rep_nome}", {"negrito": True, "cor": MARINHO})], [("Grupo BRTelecom | BRA Ambientes", {"negrito": True, "cor": MARINHO})],
                         [("CNPJ: 07.787.973/0001-61 — Fornecedora", {"cor": CINZA})]])
assinatura("/ass_bra/", [[("{bra_nome}", {"negrito": True, "cor": MARINHO})], [("CPF: {bra_cpf}", {"cor": CINZA})]])

manter_juntos()
doc.core_properties.title = "Contrato de compra, venda e instalação de sistema — BRA Ambientes"
doc.core_properties.author = "Núcleo BRA"
doc.save(SAIDA)
print("gerado:", SAIDA)
